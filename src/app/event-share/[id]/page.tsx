"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const YEAR_LABELS: Record<number, string> = { 1: "1학년", 2: "2학년", 3: "3학년", 4: "4학년", 0: "졸업유예" };

interface Attendee {
  id: string;
  name: string;
  gender: string | null;
  school: string | null;
  department: string | null;
  year: number | null;
  phone: string | null;
  friend_group: string | null;
  memo: string | null;
  custom_data: Record<string, string> | null;
}

interface Share {
  event_id: string;
  school: string;
  password: string;
}

export default function EventSharePage() {
  const params = useParams();
  const shareId = params.id as string;

  const [share, setShare] = useState<Share | null>(null);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("event_share_links")
        .select("event_id, school, password, events(name)")
        .eq("id", shareId)
        .single();
      if (data) {
        setShare({ event_id: (data as any).event_id, school: (data as any).school, password: (data as any).password });
        setEventName((data as any).events?.name || "");
      }
      setLoading(false);
    })();
  }, [shareId]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!share) return;
    if (pwInput.trim() !== share.password) {
      setPwError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setPwError("");
    setUnlocked(true);
    // 해당 학교 명단 로드
    const { data } = await supabase
      .from("event_attendees")
      .select("id, name, gender, school, department, year, phone, friend_group, memo, custom_data")
      .eq("event_id", share.event_id)
      .eq("school", share.school)
      .order("name");
    if (data) setAttendees(data as Attendee[]);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-400">불러오는 중...</div>;
  }

  if (!share) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-gray-500 text-center">유효하지 않은 링크입니다.</p>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <form onSubmit={handleUnlock} className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <h1 className="text-lg font-bold text-gray-900">{eventName}</h1>
            <p className="text-sm text-gray-500 mt-1">{share.school} 명단</p>
          </div>
          <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={pwInput}
            onChange={(e) => setPwInput(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="비밀번호 4자리"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-center tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          {pwError && <p className="text-sm text-red-500 text-center">{pwError}</p>}
          <button type="submit" disabled={pwInput.length !== 4}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            확인
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
        <h1 className="text-base font-bold">{eventName}</h1>
        <p className="text-xs text-gray-500 mt-0.5">{share.school} · {attendees.length}명</p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {attendees.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">신청자가 없습니다.</p>
        ) : (
          attendees.map((a) => {
            const isExpanded = expanded === a.id;
            return (
              <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-3">
                <button onClick={() => setExpanded(isExpanded ? null : a.id)} className="w-full text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{a.name}</span>
                    {a.gender && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        a.gender === "남" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                      }`}>{a.gender}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                    {a.department && <span>{a.department}</span>}
                    {a.year != null && <span>{YEAR_LABELS[a.year] || `${a.year}`}</span>}
                    {a.friend_group && <span>친구: {a.friend_group}</span>}
                  </div>
                </button>
                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    {a.phone && (<div><span className="text-gray-400 text-[10px]">연락처</span><p>{a.phone}</p></div>)}
                    {a.school && (<div><span className="text-gray-400 text-[10px]">학교</span><p>{a.school}</p></div>)}
                    {a.department && (<div><span className="text-gray-400 text-[10px]">학과</span><p>{a.department}</p></div>)}
                    {a.gender && (<div><span className="text-gray-400 text-[10px]">성별</span><p>{a.gender}</p></div>)}
                    {a.year != null && (<div><span className="text-gray-400 text-[10px]">학년</span><p>{YEAR_LABELS[a.year] || `${a.year}`}</p></div>)}
                    {a.friend_group && (<div className="col-span-2"><span className="text-gray-400 text-[10px]">친구</span><p>{a.friend_group}</p></div>)}
                    {a.custom_data && Object.entries(a.custom_data).filter(([, v]) => v).map(([key, val]) => (
                      <div key={key} className="col-span-2"><span className="text-gray-400 text-[10px]">{key}</span><p className="whitespace-pre-wrap">{val}</p></div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
