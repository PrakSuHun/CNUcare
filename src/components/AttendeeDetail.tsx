"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const YEAR_LABELS: Record<number, string> = { 1: "1학년", 2: "2학년", 3: "3학년", 4: "4학년", 0: "졸업유예" };
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

interface AttendeeDetailProps {
  eventId: string;
  attendeeId: string;
  basePath: string;
}

export default function AttendeeDetail({ eventId, attendeeId, basePath }: AttendeeDetailProps) {
  const router = useRouter();
  const [attendee, setAttendee] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, [attendeeId]);

  const fetchData = async () => {
    const [attRes, eventRes, recRes] = await Promise.all([
      supabase.from("event_attendees").select("*").eq("id", attendeeId).single(),
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase.from("event_attendance").select("*").eq("attendee_id", attendeeId).order("date"),
    ]);
    if (attRes.data) { setAttendee(attRes.data); setForm(attRes.data); }
    if (eventRes.data) setEvent(eventRes.data);
    if (recRes.data) setRecords(recRes.data);
    setLoading(false);
  };

  const saveInfo = async () => {
    await supabase.from("event_attendees").update({
      name: form.name, gender: form.gender, department: form.department,
      year: form.year, phone: form.phone, memo: form.memo,
    }).eq("id", attendeeId);
    setAttendee({ ...attendee, ...form });
    setEditing(false);
  };

  // 전체 출석 기록 (이 사람뿐 아니라 행사 전체)에서 주차 계산
  const [allRecords, setAllRecords] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase.from("event_attendance").select("date").eq("event_id", eventId);
      if (data) setAllRecords(data);
    };
    fetchAll();
  }, [eventId]);

  const getWeeks = () => {
    // 행사 전체 출석에서 모든 날짜 수집 → 주차 계산
    const allDates = [...new Set(allRecords.map(r => r.date))].sort();
    if (allDates.length === 0) return [];

    const firstDate = new Date(allDates[0]);
    const firstMonday = new Date(firstDate);
    firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));

    const lastDate = new Date(allDates[allDates.length - 1]);
    const weeks: { number: number; startDate: Date; attended: boolean; dates: { date: string; dayLabel: string; present: boolean }[] }[] = [];

    const current = new Date(firstMonday);
    let weekNum = 1;
    while (current <= lastDate) {
      const weekDates: { date: string; dayLabel: string; present: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(current);
        day.setDate(day.getDate() + d);
        const dateStr = day.toISOString().split("T")[0];
        const rec = records.find(r => r.date === dateStr);
        weekDates.push({
          date: dateStr,
          dayLabel: `${DAY_LABELS[day.getDay()]}(${day.getMonth()+1}/${day.getDate()})`,
          present: rec?.present || false,
        });
      }
      const attended = weekDates.some(d => d.present);
      weeks.push({ number: weekNum, startDate: new Date(current), attended, dates: weekDates });
      current.setDate(current.getDate() + 7);
      weekNum++;
    }
    return weeks;
  };

  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const toggleDay = async (date: string, currentPresent: boolean) => {
    const newPresent = !currentPresent;
    const existing = records.find(r => r.date === date);

    if (existing) {
      await supabase.from("event_attendance").update({ present: newPresent }).eq("id", existing.id);
      setRecords(records.map(r => r.id === existing.id ? { ...r, present: newPresent } : r));
    } else {
      const { data } = await supabase.from("event_attendance").insert({
        event_id: eventId, attendee_id: attendeeId, date, present: newPresent,
      }).select().single();
      if (data) setRecords([...records, data]);
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  if (!attendee) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">참가자를 찾을 수 없습니다.</p></div>;

  const weeks = getWeeks();
  const totalWeeks = weeks.filter(w => w.attended).length;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <button onClick={() => { if (window.history.length > 1) router.back(); else router.push(`${basePath}/event/${eventId}`); }} className="text-gray-500 mr-3">&larr;</button>
          <div>
            <h1 className="text-lg font-bold">{attendee.name}</h1>
            <p className="text-xs text-gray-500">{event?.name}</p>
          </div>
        </div>
        {attendee.life_id && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">생명</span>}
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 기본 정보 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">기본 정보</p>
            <button onClick={() => editing ? saveInfo() : setEditing(true)}
              className="text-xs text-blue-600 hover:underline">{editing ? "저장" : "수정"}</button>
          </div>
          {editing ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-400">이름</span>
                  <input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">성별</span>
                  <select value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value || null })}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5">
                    <option value="">미선택</option>
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-gray-400">학과</span>
                  <input value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value || null })}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400">학년</span>
                  <select value={form.year?.toString() || ""} onChange={(e) => setForm({ ...form, year: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5">
                    <option value="">미선택</option>
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                    <option value="4">4학년</option>
                    <option value="0">졸업유예</option>
                  </select>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-gray-400">연락처</span>
                <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value || null })}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">메모</span>
                <textarea value={form.memo || ""} onChange={(e) => setForm({ ...form, memo: e.target.value || null })}
                  rows={2} className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 resize-none" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-4 text-sm">
                {attendee.gender && <span className={attendee.gender === "남" ? "text-blue-600" : "text-pink-600"}>{attendee.gender}</span>}
                {attendee.department && <span className="text-gray-600">{attendee.department}</span>}
                {attendee.year != null && <span className="text-gray-600">{YEAR_LABELS[attendee.year] || attendee.year}</span>}
              </div>
              {attendee.phone && <p className="text-sm text-gray-500">{attendee.phone}</p>}
              {attendee.memo && <p className="text-sm text-gray-500">{attendee.memo}</p>}
              {!attendee.gender && !attendee.department && !attendee.phone && (
                <p className="text-xs text-gray-400">정보 없음 — 수정을 눌러 추가하세요</p>
              )}
            </div>
          )}
        </div>

        {/* 출석 요약 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-700 mb-1">출석 현황</p>
          <p className="text-2xl font-bold text-blue-600">{totalWeeks}<span className="text-sm text-gray-400 font-normal ml-1">/ {weeks.length}주 참여</span></p>
        </div>

        {/* 주차별 출석 기록 */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">출석 기록</p>
          {weeks.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">출석 기록이 없습니다.</p>
          )}
          {weeks.map((week) => {
            const isExpanded = expandedWeek === week.number;
            return (
              <div key={week.number} className="bg-white rounded-lg border border-gray-200">
                <button
                  onClick={() => setExpandedWeek(isExpanded ? null : week.number)}
                  className="w-full p-3 flex items-center justify-between text-left"
                >
                  <div>
                    <span className="text-sm font-medium">{week.number}주차</span>
                    <span className="text-xs text-gray-400 ml-2">
                      ({week.startDate.getMonth()+1}.{week.startDate.getDate()}~{
                        (() => { const end = new Date(week.startDate); end.setDate(end.getDate() + 6); return `${end.getMonth()+1}.${end.getDate()}`; })()
                      })
                    </span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    week.attended ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
                  }`}>
                    {week.attended ? "출석" : "미출석"}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                    <div className="grid grid-cols-7 gap-1">
                      {week.dates.map((d) => (
                        <button
                          key={d.date}
                          onClick={() => toggleDay(d.date, d.present)}
                          className={`py-2 rounded text-center transition-colors ${
                            d.present
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                        >
                          <p className="text-[10px] font-medium">{d.dayLabel.split("(")[0]}</p>
                          <p className="text-[9px]">{d.date.split("-").slice(1).join("/")}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
