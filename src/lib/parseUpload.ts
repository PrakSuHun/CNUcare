// 업로드 파일 파싱 (클라이언트). 이미지 → base64, 엑셀/CSV → 텍스트+행.
// 채팅 첨부 / 행사 명단 import 공용.
import * as XLSX from "xlsx";

// kind: image=사진, pdf=PDF. 둘 다 Gemini 비전이 읽음(같은 media 파트로 전송).
export interface ParsedImage { name: string; mime: string; data: string; previewUrl: string; kind: "image" | "pdf" }
export interface ParsedSheet { name: string; text: string; rows: Record<string, string>[]; headers: string[] }

const IMG_RE = /^image\//;
const SHEET_RE = /\.(xlsx|xls|csv|tsv)$/i;

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

export async function parseImage(f: File): Promise<ParsedImage> {
  const data = await fileToBase64(f);
  const mime = f.type || "image/jpeg";
  return { name: f.name, mime, data, previewUrl: `data:${mime};base64,${data}`, kind: "image" };
}
export async function parsePdf(f: File): Promise<ParsedImage> {
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
  for (const f of arr) {
    try {
      if (isImageFile(f)) images.push(await parseImage(f));
      else if (isPdfFile(f)) images.push(await parsePdf(f)); // PDF도 이미지와 같은 media 파트로
      else if (isSheetFile(f)) sheets.push(await parseSheet(f));
      else skipped.push(f.name);
    } catch {
      skipped.push(f.name);
    }
  }
  return { images, sheets, skipped };
}
