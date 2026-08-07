"use client";
// 내 생명 홈 상단 배너: 나에게 온 '행사 피드백 작성' 요청(open)을 안내.
// 클릭 → 피드백 작성 페이지(/event-feedback/[eventId]).
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export default function EventFeedbackBanner() {
  const router = useRouter();
  const [reqs, setReqs] = useState<{ event_id: string; name: string }[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    (async () => {
      const { data } = await supabase
        .from("event_feedback_requests")
        .select("event_id, events(name)")
        .eq("manager_id", u.id)
        .eq("status", "open");
      setReqs(((data || []) as any[]).map((r) => ({ event_id: r.event_id, name: r.events?.name || "행사" })));
    })();
  }, []);

  const visible = reqs.filter((r) => !dismissed.has(r.event_id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {visible.map((r) => (
        <div key={r.event_id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
          <span className="text-sm text-green-800 flex-1 min-w-0">
            <b>{r.name}</b> 행사 피드백을 작성해 주세요
          </span>
          <button
            onClick={() => router.push(`/event-feedback/${r.event_id}`)}
            className="text-xs bg-green-600 text-white rounded-full px-3 py-1.5 font-medium whitespace-nowrap"
          >
            작성하기
          </button>
          <button
            onClick={() => setDismissed((p) => new Set(p).add(r.event_id))}
            className="text-green-400 text-lg leading-none px-1"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
