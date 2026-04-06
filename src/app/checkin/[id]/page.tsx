"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function CheckinPage() {
  const params = useParams();
  const formId = params.id as string;

  const [form, setForm] = useState<any>(null);
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ success: boolean; attendee?: any; message?: string } | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);

  useEffect(() => {
    const fetchForm = async () => {
      const { data } = await supabase
        .from("event_forms")
        .select("*, events(id, name)")
        .eq("id", formId)
        .eq("type", "checkin_individual")
        .single();
      if (data) {
        setForm(data);
        setEventId((data.events as any)?.id || "");
        setEventName((data.events as any)?.name || "");
      }
      setLoading(false);
    };
    fetchForm();
  }, [formId]);

  const doCheckin = async (attendee: any) => {
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("event_attendance").upsert({
      event_id: eventId,
      attendee_id: attendee.id,
      date: today,
      present: true,
    }, { onConflict: "attendee_id,date" });

    if (attendee.life_id) {
      const { data: existing } = await supabase.from("journals")
        .select("id").eq("life_id", attendee.life_id).eq("met_date", today).eq("location", eventName).limit(1);
      if (!existing || existing.length === 0) {
        await supabase.from("journals").insert({
          life_id: attendee.life_id, met_date: today, location: eventName,
          response: `[${eventName}] 출석완료`, purpose: "management",
        });
      }
    }

    setCandidates([]);
    setResult({ success: true, attendee });
  };

  const handleCheckin = async () => {
    if (!name.trim() || !eventId) return;
    setChecking(true);
    setResult(null);

    // 참가자 찾기
    const { data: matches } = await supabase
      .from("event_attendees")
      .select("*")
      .eq("event_id", eventId)
      .eq("name", name.trim());

    if (!matches || matches.length === 0) {
      setResult({ success: false, message: "등록된 참가자를 찾을 수 없습니다." });
      setChecking(false);
      return;
    }

    if (matches.length > 1) {
      // 동명이인 → 후보 목록 표시
      setCandidates(matches);
      setChecking(false);
      return;
    }

    // 1명이면 바로 출석
    await doCheckin(matches[0]);
    setChecking(false);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  if (!form) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">출석 폼을 찾을 수 없습니다.</p></div>;

  const config = form.config as any;
  const popupText = config?.popup_text || "";
  const showFields = config?.show_fields || []; // ["department", "team", ...]

  const fieldLabels: Record<string, string> = {
    department: "학과", team: "팀", year: "학년", gender: "성별", phone: "연락처", friend_group: "친구",
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 text-center shrink-0">
        <h1 className="text-lg font-bold">{eventName}</h1>
        <p className="text-xs text-gray-500">출석체크</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
        {candidates.length > 0 ? (
          <div className="w-full max-w-sm space-y-3">
            <p className="text-sm font-medium text-gray-700 text-center">동명이인이 있습니다. 본인을 선택하세요.</p>
            {candidates.map((c) => (
              <button key={c.id} onClick={() => doCheckin(c)}
                className="w-full bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-300 transition-colors">
                <p className="text-sm font-bold">{c.name}</p>
                <div className="flex gap-2 text-xs text-gray-500 mt-1">
                  {c.department && <span>{c.department}</span>}
                  {c.year != null && <span>{{ 1: "1학년", 2: "2학년", 3: "3학년", 4: "4학년", 0: "졸업유예" }[c.year as number] || `${c.year}`}</span>}
                  {c.gender && <span>{c.gender}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </button>
            ))}
            <button onClick={() => { setCandidates([]); setName(""); }} className="w-full text-sm text-gray-500 py-2">취소</button>
          </div>
        ) : result ? (
          result.success ? (
            <div className="text-center space-y-4 w-full max-w-sm">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 space-y-3">
                <div className="text-5xl">✓</div>
                <p className="text-xl font-bold text-green-700">출석 완료!</p>
                <p className="text-base font-medium text-gray-800">{result.attendee.name}</p>
                {showFields.map((f: string) => {
                  let val: string | null = null;
                  let label = fieldLabels[f] || f;
                  if (f.startsWith("custom_data.")) {
                    const key = f.replace("custom_data.", "");
                    val = result.attendee.custom_data?.[key] || null;
                    label = key;
                  } else if (f === "year") {
                    const y = result.attendee.year;
                    const yearLabels: Record<number, string> = { 1: "1학년", 2: "2학년", 3: "3학년", 4: "4학년", 0: "졸업유예" };
                    val = y != null ? yearLabels[y] || `${y}` : null;
                  } else {
                    val = result.attendee[f];
                  }
                  return val ? <p key={f} className="text-sm text-gray-600">{label}: {val}</p> : null;
                })}
                {popupText && <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap">{popupText}</p>}
              </div>
              <button onClick={() => { setResult(null); setName(""); }}
                className="text-sm text-blue-600 hover:underline">다른 사람 출석하기</button>
            </div>
          ) : (
            <div className="text-center space-y-4 w-full max-w-sm">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <p className="text-lg font-bold text-red-600">{result.message}</p>
              </div>
              <button onClick={() => { setResult(null); setName(""); }}
                className="text-sm text-blue-600 hover:underline">다시 시도</button>
            </div>
          )
        ) : (
          <div className="w-full max-w-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCheckin(); }}
                placeholder="이름을 입력하세요" autoFocus
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg text-center" />
            </div>
            <button onClick={handleCheckin} disabled={!name.trim() || checking}
              className="w-full bg-blue-600 text-white rounded-lg py-3 text-base font-semibold disabled:opacity-50">
              {checking ? "확인 중..." : "출석하기"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
