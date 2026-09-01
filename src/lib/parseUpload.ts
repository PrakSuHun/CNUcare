// 업로드 파일 파싱 (클라이언트). 이미지 → base64, 엑셀/CSV → 텍스트+행.
// 채팅 첨부 / 행사 명단 import 공용.
import * as XLSX from "xlsx";

// kind: image=사진, pdf=PDF. 이미지는 Codex 우선, PDF는 Gemini로 안전하게 분기한다.
export interface ParsedImage { name: string; mime: string; data: string; previewUrl: string; kind: "image" | "pdf" }
export interface ParsedSheet { name: string; text: string; rows: Record<string, string>[]; headers: string[] }

const IMG_RE = /^image\//;
const SHEET_RE = /\.(xlsx|xls|csv|tsv)$/i;
// Vercel 요청 본문 상한보다 충분히 작게 유지해 여러 이미지를 한 번에 보내도 413이 나지 않게 한다.
const MAX_ORIGINAL_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_BASE64_CHARS = 580_000;
const MAX_TOTAL_MEDIA_BASE64_CHARS = 3_500_000;
const MAX_PDF_BYTES = 2_500_000;

export function isImageFile(f: File): boolean {
  return IMG_RE.test(f.type) || /\.(png|jpe?g|gif|webp|heic|heif)$/i.test(f.name);
}
export function isPdfFile(f: File): boolean {
  return f.type === "application/pdf" || /\.pdf$/i.test(f.name);
}
export function isSheetFile(f: File): boolean {
  return SHEET_RE.test(f.name) ||
    /(spreadsheet|excel|csv)/i.test(f.type);
}

function fileToBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.includes(",") ? s.split(",")[1] : s); // data: 프리픽스 제거
    };
    r.onerror = reject;
    r.readAsDataURL(f);
  });
}

// 큰 스크린샷은 리사이즈·JPEG 재인코딩해 용량을 줄인다(요청 초과 방지).
// 명단 글자 가독성을 위해 긴 변 최대 2000px를 유지하며 용량이 클 때 단계적으로 줄인다.
async function compressImage(f: File): Promise<{ data: string; mime: string }> {
  if (f.size > MAX_ORIGINAL_IMAGE_BYTES) throw new Error("image-too-large");
  try {
    if (typeof document === "undefined" || typeof createImageBitmap === "undefined") throw new Error("no-canvas");
    const bitmap = await createImageBitmap(f);
    const MAX = 2000;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    let w = Math.max(1, Math.round(bitmap.width * scale));
    let h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    let quality = 0.82;
    try {
      for (let attempt = 0; attempt < 8; attempt++) {
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no-ctx");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(bitmap, 0, 0, w, h);
        const data = (canvas.toDataURL("image/jpeg", quality).split(",")[1] || "");
        if (!data) throw new Error("empty");
        if (data.length <= MAX_IMAGE_BASE64_CHARS) return { data, mime: "image/jpeg" };
        if (quality > 0.58) quality -= 0.08;
        else {
          w = Math.max(900, Math.round(w * 0.82));
          h = Math.max(900, Math.round(h * 0.82));
          quality = 0.72;
        }
      }
      throw new Error("compressed-image-too-large");
    } finally {
      bitmap.close?.();
    }
  } catch {
    // 캔버스를 쓸 수 없는 환경에서는 원본을 사용하되 요청 상한을 넘기면 명시적으로 제외한다.
    const data = await fileToBase64(f);
    if (data.length > MAX_IMAGE_BASE64_CHARS) throw new Error("image-too-large-after-compress");
    return { data, mime: f.type || "image/jpeg" };
  }
}

export async function parseImage(f: File): Promise<ParsedImage> {
  const { data, mime } = await compressImage(f);
  return { name: f.name, mime, data, previewUrl: `data:${mime};base64,${data}`, kind: "image" };
}
export async function parsePdf(f: File): Promise<ParsedImage> {
  if (f.size > MAX_PDF_BYTES) throw new Error("pdf-too-large");
  const data = await fileToBase64(f);
  return { name: f.name, mime: "application/pdf", data, previewUrl: "", kind: "pdf" };
}

export async function parseSheet(f: File): Promise<ParsedSheet> {
  const buf = await f.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  let rows: Record<string, string>[] = [];
  let headers: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(ws).trim();
    if (!csv) continue;
    if (wb.SheetNames.length > 1) parts.push(`# ${sheetName}\n${csv}`);
    else parts.push(csv);
    // 첫 시트를 구조화 행으로 (명단 import용)
    if (rows.length === 0) {
      const json = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }) as Record<string, string>[];
      if (json.length) { rows = json; headers = Object.keys(json[0]); }
    }
  }
  return { name: f.name, text: parts.join("\n\n"), rows, headers };
}

export interface ParsedFiles { images: ParsedImage[]; sheets: ParsedSheet[]; skipped: string[] }

export async function parseFiles(files: FileList | File[]): Promise<ParsedFiles> {
  const arr = Array.from(files);
  const images: ParsedImage[] = [];
  const sheets: ParsedSheet[] = [];
  const skipped: string[] = [];
  let mediaChars = 0;
  for (const f of arr) {
    try {
      if (isImageFile(f) || isPdfFile(f)) {
        const parsed = isImageFile(f) ? await parseImage(f) : await parsePdf(f);
        if (mediaChars + parsed.data.length > MAX_TOTAL_MEDIA_BASE64_CHARS) {
          skipped.push(`${f.name}(첨부 용량 초과)`);
          continue;
        }
        mediaChars += parsed.data.length;
        images.push(parsed);
      }
      else if (isSheetFile(f)) sheets.push(await parseSheet(f));
      else skipped.push(f.name);
    } catch {
      skipped.push(`${f.name}(읽기/용량 오류)`);
    }
  }
  return { images, sheets, skipped };
}
