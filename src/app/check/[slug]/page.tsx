"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function CheckInPage() {
  const params = useParams();
  const slug = decodeURIComponent(params.slug as string);

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [companions, setCompanions] = useState<string[]>([]);
  const [companionInput, setCompanionInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      const { data } = await supabase.from("events").select("*").eq("slug", slug).single();
      setEvent(data);
      setLoading(false);
    };
    fetchEvent();
  }, [slug]);

  const addCompanion = () => {
    const trimmed = companionInput.trim();
    if (trimmed && !companions.includes(trimmed)) {
      setCompanions([...companions, trimmed]);
      setCompanionInput("");
    }
  };

  const removeCompanion = (c: string) => {
    setCompanions(companions.filter((x) => x !== c));
  };

  const handleSubmit = async () => {
    if (!name.trim() || !event) return;
    setSubmitting(true);

    const allNames = [name.trim(), ...companions];
    const groupId = crypto.randomUUID();

    for (const n of allNames) {
      // 참석자 찾거나 생성
      let { data: attendee } = await supabase
        .from("event_attendees")
        .select("id")
        .eq("event_id", event.id)
        .eq("name", n)
        .single();

      if (!attendee) {
        const { data: created } = await supabase
          .from("event_attendees")
          .insert({ event_id: event.id, name: n })
          .select("id")
          .single();
        attendee = created;
      }

      if (attendee) {
        // 출석 기록
        await supabase.from("event_attendance").upsert({
          event_id: event.id,
          attendee_id: attendee.id,
          date,
          present: true,
          check_group: groupId,
        }, { onConflict: "attendee_id,date" });

        // 생명 연동: attendee에 life_id가 있으면 일지 자동 생성
        const { data: att } = await supabase
          .from("event_attendees")
          .select("life_id")
          .eq("id", attendee.id)
          .single();

        if (att?.life_id) {
          // 같은 날 같은 행사 일지가 이미 있는지 확인
          const { data: existing } = await supabase
            .from("journals")
            .select("id")
            .eq("life_id", att.life_id)
            .eq("met_date", date)
            .eq("location", event.name)
            .limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("journals").insert({
              life_id: att.life_id,
              met_date: date,
              location: event.name,
              response: `[${event.name}] 출석완료`,
              purpose: "management",
            });
          }
        }
      }
    }

    setSubmitting(false);
    setDone(true);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">행사를 찾을 수 없습니다.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">✓</div>
          <p className="text-lg font-bold text-gray-800">출석 완료!</p>
          <p className="text-sm text-gray-500">{name} 외 {companions.length}명</p>
          <button
            onClick={() => { setDone(false); setName(""); setCompanions([]); }}
            className="text-sm text-blue-600 hover:underline"
          >
            다른 사람 출석하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 text-center shrink-0">
        <h1 className="text-lg font-bold">{event.name}</h1>
        <p className="text-xs text-gray-500">출석체크</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="본인 이름"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">함께 띈 사람</label>
          {companions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {companions.map((c) => (
                <span key={c} className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full flex items-center gap-1">
                  {c}
                  <button onClick={() => removeCompanion(c)} className="text-blue-400 hover:text-blue-600">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={companionInput}
              onChange={(e) => setCompanionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCompanion(); } }}
              placeholder="이름 입력"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-base"
            />
            <button
              onClick={addCompanion}
              disabled={!companionInput.trim()}
              className="px-4 py-3 bg-gray-200 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              추가
            </button>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-base font-semibold disabled:opacity-50"
        >
          {submitting ? "처리 중..." : "출석 완료"}
        </button>
      </div>
    </div>
  );
}
