import { NextRequest, NextResponse } from "next/server";
import { lookupEventDuplicates } from "@/lib/rosterLookup";

// 행사탭 상단 배너용: 이 행사 참여자 중 다른 행사·프로젠·생명과 겹치는 "중복 의심자" 목록.
export async function GET(req: NextRequest) {
  const eventId = req.nextUrl.searchParams.get("event_id");
  if (!eventId) return NextResponse.json({ suspects: [] });
  try {
    const suspects = await lookupEventDuplicates(eventId);
    return NextResponse.json({ suspects });
  } catch (e: any) {
    return NextResponse.json({ suspects: [], error: e?.message }, { status: 200 });
  }
}
