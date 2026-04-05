"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function RegisterPage() {
  const params = useParams();
  const formId = params.id as string;

  const [form, setForm] = useState<any>(null);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // 기본 필드
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [year, setYear] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [friendNames, setFriendNames] = useState("");
  // 커스텀 필드
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchForm = async () => {
      const { data } = await supabase
        .from("event_forms")
        .select("*, events(id, name)")
        .eq("id", formId)
        .eq("type", "registration")
        .single();
      if (data) {
        setForm(data);
        setEventName((data.events as any)?.name || "");
        const init: Record<string, string> = {};
        ((data.config as any)?.custom_fields || []).forEach((f: string) => { init[f] = ""; });
        setCustomAnswers(init);
      }
      setLoading(false);
    };
    fetchForm();
  }, [formId]);

  const handleSubmit = async () => {
    if (!name.trim() || !form) return;
    setSubmitting(true);

    const eventId = (form.events as any)?.id;

    // 중복 체크
    const { data: existing } = await supabase
      .from("event_attendees")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", name.trim())
      .limit(1);

    if (existing && existing.length > 0) {
      alert("이미 신청된 이름입니다.");
      setSubmitting(false);
      return;
    }

    const yearNum = year ? parseInt(year) : null;

    await supabase.from("event_attendees").insert({
      event_id: eventId,
      name: name.trim(),
      gender: gender || null,
      year: yearNum,
      department: department.trim() || null,
      phone: phone.trim() || null,
      friend_group: friendNames.trim() || null,
      custom_data: Object.fromEntries(Object.entries(customAnswers).filter(([, v]) => v.trim())),
    });

    setSubmitting(false);
    setDone(true);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  if (!form) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">신청 폼을 찾을 수 없습니다.</p></div>;

  if (done) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">✓</div>
          <p className="text-lg font-bold text-gray-800">신청 완료!</p>
          <p className="text-sm text-gray-500">{eventName}</p>
          <button onClick={() => { setDone(false); setName(""); setGender(""); setYear(""); setDepartment(""); setPhone(""); setFriendNames(""); setCustomAnswers(Object.fromEntries(Object.keys(customAnswers).map(k => [k, ""]))); }}
            className="text-sm text-blue-600 hover:underline">다른 사람 신청하기</button>
        </div>
      </div>
    );
  }

  const config = form.config as any;
  const customFields = config?.custom_fields || [];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 text-center shrink-0">
        <h1 className="text-lg font-bold">{eventName}</h1>
        <p className="text-xs text-gray-500">행사 신청</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="이름" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">성별</label>
          <select value={gender} onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base">
            <option value="">선택</option>
            <option value="남">남</option>
            <option value="여">여</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base">
            <option value="">선택</option>
            <option value="1">1학년</option>
            <option value="2">2학년</option>
            <option value="3">3학년</option>
            <option value="4">4학년</option>
            <option value="0">졸업유예</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">학과</label>
          <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
            placeholder="학과" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">함께 신청한 친구</label>
          <input type="text" value={friendNames} onChange={(e) => setFriendNames(e.target.value)}
            placeholder="친구 이름 (쉼표로 구분)" className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base" />
        </div>

        {customFields.map((field: string) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field}</label>
            <input type="text" value={customAnswers[field] || ""} onChange={(e) => setCustomAnswers(prev => ({ ...prev, [field]: e.target.value }))}
              placeholder={field} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base" />
          </div>
        ))}

        <button onClick={handleSubmit} disabled={!name.trim() || submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-base font-semibold disabled:opacity-50">
          {submitting ? "신청 중..." : "신청하기"}
        </button>
      </div>
    </div>
  );
}
