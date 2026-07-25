import { NextRequest, NextResponse } from "next/server";
import { mapSheetRows, extractFromMedia, dedupeAttendees, type Attendee } from "@/lib/extractRoster";

// 명단 파일(엑셀 rows / 이미지 / PDF)에서 참석자 목록을 추출한다.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
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
