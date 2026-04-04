"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface CalendarAppointment {
  id: string;
  life_id: string;
  life_name: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  instructor_name: string | null;
  note: string | null;
}

export default function InstructorCalendar({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [myLives, setMyLives] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    life_id: "", title: "", date: new Date().toISOString().split("T")[0],
    time: "", location: "", note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const user = getUser();
    if (!user) return;

    // 내 생명 목록
    const { data: ul } = await supabase
      .from("user_lives").select("life_id, lives(id, name)").eq("user_id", user.id);
    const lives = (ul || []).map((u: any) => u.lives).filter(Boolean);
    setMyLives(lives);

    // 내 이름이 강의자인 약속 + 내 생명의 약속
    const lifeIds = lives.map((l: any) => l.id);
    const { data: appts } = await supabase
      .from("appointments")
      .select("*, life:lives(name)")
      .or(`instructor_name.eq.${user.display_name}${lifeIds.length > 0 ? `,life_id.in.(${lifeIds.join(",")})` : ""}`)
      .order("date")
      .order("time");

    if (appts) {
      setAppointments(appts.map((a: any) => ({
        ...a,
        life_name: a.life?.name || "",
      })));
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    const user = getUser();
    if (!user || !form.life_id || !form.title || !form.date) return;
    setSaving(true);
    await supabase.from("appointments").insert({
      life_id: form.life_id,
      title: form.title,
      date: form.date,
      time: form.time || null,
      location: form.location || null,
      instructor_name: user.display_name,
      note: form.note || null,
      created_by: user.id,
    });
    setForm({ life_id: "", title: "", date: selectedDate, time: "", location: "", note: "" });
    setShowForm(false);
    setSaving(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 약속을 삭제하시겠습니까?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    fetchAll();
  };

  // 달력 생성
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dayAppointments = (day: number) => appointments.filter((a) => a.date === getDateStr(day));
  const selectedAppointments = appointments.filter((a) => a.date === selectedDate);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  if (loading) return <p className="text-center text-sm text-gray-400 py-8">로딩 중...</p>;

  return (
    <div className="space-y-4">
      {/* 달력 헤더 */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="text-gray-400 hover:text-gray-600 px-2">&larr;</button>
          <span className="text-sm font-bold">{year}년 {month + 1}월</span>
          <button onClick={nextMonth} className="text-gray-400 hover:text-gray-600 px-2">&rarr;</button>
        </div>

        {/* 요일 */}
        <div className="grid grid-cols-7 text-center text-[10px] text-gray-400 mb-1">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => <span key={d}>{d}</span>)}
        </div>

        {/* 날짜 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={i} />;
            const dateStr = getDateStr(day);
            const hasAppt = dayAppointments(day).length > 0;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative h-9 rounded-lg text-xs font-medium transition-colors ${
                  isSelected ? "bg-blue-600 text-white" :
                  isToday ? "bg-blue-100 text-blue-700" :
                  "hover:bg-gray-100"
                }`}
              >
                {day}
                {hasAppt && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                    isSelected ? "bg-white" : "bg-blue-500"
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 일정 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          {selectedDate} ({selectedAppointments.length}건)
        </p>
        <button
          onClick={() => { setForm((f) => ({ ...f, date: selectedDate })); setShowForm(!showForm); }}
          className="text-xs text-blue-500 border border-blue-300 rounded-full px-3 py-1"
        >
          {showForm ? "취소" : "+ 일정 추가"}
        </button>
      </div>

      {/* 일정 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <select value={form.life_id} onChange={(e) => setForm((f) => ({ ...f, life_id: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none">
            <option value="">생명 선택</option>
            {myLives.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <input type="text" placeholder="제목 (예: 삼분설 강의)" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
          <input type="text" placeholder="장소" value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
          <button onClick={handleCreate} disabled={!form.life_id || !form.title || saving}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "저장 중..." : "일정 추가"}
          </button>
        </div>
      )}

      {/* 일정 목록 */}
      {selectedAppointments.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 text-center py-4">이 날짜에 일정이 없습니다.</p>
      )}

      {selectedAppointments.map((a) => (
        <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-start justify-between">
            <button onClick={() => router.push(`${basePath}/life/${a.life_id}`)} className="text-left flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{a.title}</span>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{a.life_name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                {a.time && <span>{a.time}</span>}
                {a.location && <span>· {a.location}</span>}
              </div>
              {a.note && <p className="text-xs text-gray-400 mt-1">{a.note}</p>}
            </button>
            <button onClick={() => handleDelete(a.id)} className="text-xs text-gray-300 hover:text-red-400 ml-2 shrink-0">삭제</button>
          </div>
        </div>
      ))}
    </div>
  );
}
