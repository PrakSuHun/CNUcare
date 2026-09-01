import { NextRequest, NextResponse } from "next/server";
import { mapSheetRows, extractFromMedia, dedupeAttendees, type Attendee, type MediaPart } from "@/lib/extractRoster";

const MAX_MEDIA_BASE64_CHARS = 3_500_000;

function readMedia(value: unknown): MediaPart[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 6) return null;
  let total = 0;
  const media: MediaPart[] = [];
  for (const raw of value) {
    const item = raw as { mime?: unknown; data?: unknown };
    const mime = String(item?.mime ?? "").toLowerCase().trim();
    const data = String(item?.data ?? "").trim();
    if (!(mime === "application/pdf" || mime.startsWith("image/")) || !data) return null;
    total += data.length;
    if (total > MAX_MEDIA_BASE64_CHARS) return null;
    media.push({ mime, data });
  }
  return media;
}

// 명단 파일(엑셀 rows / 이미지 / PDF)에서 참석자 목록을 추출한다.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const images = readMedia(body.images);
    if (!images) return NextResponse.json({ attendees: [], error: "첨부 형식 또는 용량이 올바르지 않습니다." });
    const sheets = Array.isArray(body.sheets) ? body.sheets.slice(0, 6) : [];

    const attendees: Attendee[] = [];
    for (const s of sheets) {
      if (Array.isArray(s.rows) && Array.isArray(s.headers)) attendees.push(...mapSheetRows(s.rows, s.headers));
    }
    if (images.length) attendees.push(...(await extractFromMedia(images)));

    return NextResponse.json({ attendees: dedupeAttendees(attendees) });
  } catch (e: any) {
    return NextResponse.json({ attendees: [], error: e?.message }, { status: 200 });
  }
}
