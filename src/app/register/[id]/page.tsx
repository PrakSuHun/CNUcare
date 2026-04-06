"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "dropdown" | "checkbox";
  required: boolean;
  options?: string[];
  builtin?: boolean;
}

export default function RegisterPage() {
  const params = useParams();
  const formId = params.id as string;

  const [fields, setFields] = useState<FormField[]>([]);
  const [eventId, setEventId] = useState("");
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [dupFound, setDupFound] = useState<any>(null); // 중복 발견 시 기존 데이터

  useEffect(() => {
    const fetchForm = async () => {
      const { data } = await supabase
        .from("event_forms")
        .select("*, events(id, name)")
        .eq("id", formId)
        .eq("type", "registration")
        .single();
      if (data) {
        setEventId((data.events as any)?.id || "");
        setEventName((data.events as any)?.name || "");
        const config = data.config as any;
        // 새 구조 (fields 배열) 또는 이전 구조 (custom_fields) 지원
        if (config?.fields) {
          setFields(config.fields);
          const init: Record<string, any> = {};
          config.fields.forEach((f: FormField) => { init[f.id] = f.type === "checkbox" ? [] : ""; });
          setAnswers(init);
        } else {
          // 이전 호환
          const defaultFields: FormField[] = [
            { id: "name", label: "이름", type: "text", required: true, builtin: true },
            { id: "gender", label: "성별", type: "dropdown", required: false, options: ["남", "여"], builtin: true },
            { id: "year", label: "학년", type: "dropdown", required: false, options: ["1학년", "2학년", "3학년", "4학년", "졸업유예"], builtin: true },
            { id: "department", label: "학과", type: "text", required: false, builtin: true },
            { id: "phone", label: "연락처", type: "text", required: false, builtin: true },
            { id: "friend_group", label: "함께 신청한 친구", type: "text", required: false, builtin: true },
          ];
          (config?.custom_fields || []).forEach((f: string) => {
            defaultFields.push({ id: `custom_${f}`, label: f, type: "text", required: false });
          });
          setFields(defaultFields);
          const init: Record<string, any> = {};
          defaultFields.forEach((f) => { init[f.id] = ""; });
          setAnswers(init);
        }
      }
      setLoading(false);
    };
    fetchForm();
  }, [formId]);

  const handleSubmit = async () => {
    const nameVal = (answers["name"] || "").trim();
    if (!nameVal) return;

    // 필수 체크
    for (const f of fields) {
      if (f.required) {
        const val = answers[f.id];
        if (!val || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0)) {
          alert(`"${f.label}" 항목은 필수입니다.`);
          return;
        }
      }
    }

    setSubmitting(true);

    // 중복 체크 (이름 또는 전화번호)
    const phoneVal = (answers["phone"] || "").trim();
    const { data: dupByName } = await supabase
      .from("event_attendees").select("id, name, department, year, is_member").eq("event_id", eventId).eq("name", nameVal).limit(1);
    const { data: dupByPhone } = phoneVal ? await supabase
      .from("event_attendees").select("id, name, department, year, is_member").eq("event_id", eventId).eq("phone", phoneVal).limit(1) : { data: null };
    const dup = dupByName?.[0] || dupByPhone?.[0];

    // 섭리회원이면 중복 안 물어보고 덮어쓰기
    if (dup?.is_member) {
      const bMap: Record<string, string> = { name: "name", gender: "gender", department: "department", phone: "phone", friend_group: "friend_group" };
      const updateRow: Record<string, any> = {};
      const updateCustom: Record<string, any> = {};
      for (const f of fields) {
        const val = answers[f.id];
        if (f.id === "name") continue;
        if (f.id === "year") {
          const yearMap: Record<string, number> = { "1학년": 1, "2학년": 2, "3학년": 3, "4학년": 4, "졸업유예": 0 };
          const y = yearMap[val] ?? (val ? parseInt(val) : null);
          if (y !== null) updateRow.year = y;
        } else if (bMap[f.id]) {
          const v = typeof val === "string" ? val.trim() : val;
          if (v) updateRow[bMap[f.id]] = v;
        } else {
          if (Array.isArray(val) && val.length > 0) updateCustom[f.label] = val.join(", ");
          else if (typeof val === "string" && val.trim()) updateCustom[f.label] = val.trim();
        }
      }
      if (Object.keys(updateCustom).length > 0) updateRow.custom_data = updateCustom;
      await supabase.from("event_attendees").update(updateRow).eq("id", dup.id);
      setSubmitting(false);
      setDone(true);
      return;
    }

    if (dup && dupFound !== "confirmed") {
      setDupFound(dup);
      setSubmitting(false);
      return;
    }

    // builtin 필드 → DB 컬럼, 나머지 → custom_data
    const builtinMap: Record<string, string> = { name: "name", gender: "gender", department: "department", phone: "phone", friend_group: "friend_group" };
    // 섭리회원 자동 판별 (이름이 가입된 사용자와 일치하면 섭리회원)
    const { data: matchedUser } = await supabase
      .from("users").select("id").eq("display_name", nameVal).limit(1);
    const isMember = !!(matchedUser && matchedUser.length > 0);

    const row: Record<string, any> = { event_id: eventId, is_member: isMember, status: "pending" };
    const customData: Record<string, any> = {};

    for (const f of fields) {
      const val = answers[f.id];
      if (f.id === "year") {
        const yearMap: Record<string, number> = { "1학년": 1, "2학년": 2, "3학년": 3, "4학년": 4, "졸업유예": 0 };
        row.year = yearMap[val] ?? (val ? parseInt(val) : null);
      } else if (builtinMap[f.id]) {
        row[builtinMap[f.id]] = typeof val === "string" ? val.trim() || null : val || null;
      } else {
        // 커스텀 필드
        if (Array.isArray(val)) {
          if (val.length > 0) customData[f.label] = val.join(", ");
        } else if (typeof val === "string" && val.trim()) {
          customData[f.label] = val.trim();
        }
      }
    }

    if (Object.keys(customData).length > 0) row.custom_data = customData;

    await supabase.from("event_attendees").insert(row);
    setSubmitting(false);
    setDone(true);
  };

  const resetForm = () => {
    setDone(false);
    const init: Record<string, any> = {};
    fields.forEach((f) => { init[f.id] = f.type === "checkbox" ? [] : ""; });
    setAnswers(init);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  if (!fields.length) return <div className="flex h-full items-center justify-center"><p className="text-gray-500">신청 폼을 찾을 수 없습니다.</p></div>;

  if (done) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">✓</div>
          <p className="text-lg font-bold text-gray-800">신청 완료!</p>
          <p className="text-sm text-gray-500">{eventName}</p>
          <button onClick={resetForm} className="text-sm text-blue-600 hover:underline">다른 사람 신청하기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 text-center shrink-0">
        <h1 className="text-lg font-bold">{eventName}</h1>
        <p className="text-xs text-gray-500">행사 신청</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {f.label} <span className={f.required ? "text-red-500 text-xs" : "text-gray-400 text-xs"}>{f.required ? "필수" : "선택"}</span>
            </label>

            {f.type === "text" && (
              <input type={f.id === "phone" ? "tel" : "text"}
                value={answers[f.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                placeholder={f.label}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base" />
            )}

            {f.type === "textarea" && (
              <textarea
                value={answers[f.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                placeholder={f.label}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base resize-y" />
            )}

            {f.type === "dropdown" && (
              <select
                value={answers[f.id] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [f.id]: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base">
                <option value="">선택</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            )}

            {f.type === "checkbox" && (
              <div className="flex flex-wrap gap-3 mt-1">
                {f.options?.map((o) => (
                  <label key={o} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="checkbox"
                      checked={(answers[f.id] || []).includes(o)}
                      onChange={(e) => {
                        const arr = [...(answers[f.id] || [])];
                        if (e.target.checked) arr.push(o); else arr.splice(arr.indexOf(o), 1);
                        setAnswers((prev) => ({ ...prev, [f.id]: arr }));
                      }}
                      className="w-4 h-4" />
                    {o}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}

        {dupFound && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-yellow-800">이미 신청된 정보가 있습니다.</p>
            <div className="text-xs text-yellow-700">
              <p>이름: {dupFound.name}</p>
              {dupFound.department && <p>학과: {dupFound.department}</p>}
              {dupFound.year && <p>학년: {dupFound.year}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setDupFound(null); setSubmitting(false); }}
                className="flex-1 bg-yellow-500 text-white rounded-lg py-2 text-sm font-medium">본인입니다 (취소)</button>
              <button onClick={() => { setDupFound("confirmed"); handleSubmit(); }}
                className="flex-1 bg-white text-yellow-700 border border-yellow-400 rounded-lg py-2 text-sm font-medium">동명이인 (신청)</button>
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-base font-semibold disabled:opacity-50">
          {submitting ? "신청 중..." : "신청하기"}
        </button>
      </div>
    </div>
  );
}
