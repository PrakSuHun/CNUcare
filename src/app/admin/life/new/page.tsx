"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, User } from "@/lib/auth";

interface SimilarLife {
  id: string;
  name: string;
  age: number | null;
  department: string | null;
  stage: string;
}

export default function NewLifePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [step, setStep] = useState<"name" | "similar" | "form">("name");
  const [name, setName] = useState("");
  const [similarLives, setSimilarLives] = useState<SimilarLife[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    student_id_number: "", age: "", grade: "", department: "", mbti: "",
    meeting_reason: "", has_partner: "", characteristics: "", birth_year: "",
  });

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/"); return; }
    setUser(u);
  }, [router]);

  const handleNameSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const { data } = await supabase.from("lives").select("id, name, age, department, stage").ilike("name", `%${name.trim()}%`);
    if (data && data.length > 0) { setSimilarLives(data); setStep("similar"); }
    else setStep("form");
    setLoading(false);
  };

  const handleLinkExisting = async (lifeId: string) => {
    if (!user) return;
    setLoading(true);
    const { error: ulErr } = await supabase.from("user_lives").insert({ user_id: user.id, life_id: lifeId, role_in_life: "manager" });
    const { error: updErr } = await supabase.from("lives").update({ primary_user_id: user.id }).eq("id", lifeId).is("primary_user_id", null);
    setLoading(false);
    if (ulErr || updErr) {
      alert("연결 실패: " + ((ulErr || updErr)?.message || ""));
      return;
    }
    router.push("/admin");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data: newLife } = await supabase.from("lives").insert({
      name: name.trim(),
      student_id_number: form.student_id_number || null,
      age: form.age ? parseInt(form.age) : null,
      grade: form.grade || null,
      department: form.department || null,
      mbti: form.mbti || null,
      meeting_reason: form.meeting_reason || null,
      has_partner: form.has_partner === "" ? null : form.has_partner === "true",
      characteristics: form.characteristics || null,
      birth_year: form.birth_year || null,
      primary_user_id: user.id,
    }).select("id").single();
    if (!newLife) { alert("생명 등록에 실패했습니다."); setLoading(false); return; }
    await supabase.from("user_lives").insert({ user_id: user.id, life_id: newLife.id, role_in_life: "manager" });
    router.push("/admin");
  };

  const updateForm = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => step === "name" ? router.push("/admin") : setStep("name")} className="text-gray-500 mr-3">&larr;</button>
        <h1 className="text-lg font-bold">생명 추가</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {step === "name" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">생명의 이름을 입력해주세요.</p>
            <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <button onClick={handleNameSubmit} disabled={!name.trim() || loading} className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "검색 중..." : "다음"}</button>
          </div>
        )}
        {step === "similar" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">비슷한 이름의 생명이 있습니다.</p>
            {similarLives.map((life) => (
              <button key={life.id} onClick={() => handleLinkExisting(life.id)} disabled={loading} className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300">
                <p className="font-semibold">{life.name}</p>
                <p className="text-xs text-gray-500 mt-1">{life.age ? `${life.age}세` : ""} {life.department || ""}</p>
              </button>
            ))}
            <button onClick={() => setStep("form")} className="w-full rounded-lg border border-gray-300 py-3 text-base text-gray-600 hover:bg-gray-100">아니요, 새로 등록할게요</button>
          </div>
        )}
        {step === "form" && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900 mb-1">이름</p>
              <p className="text-base">{name}</p>
            </div>
            <input type="text" placeholder="학번 (나이)" value={form.student_id_number} onChange={(e) => updateForm("student_id_number", e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="나이" value={form.age} onChange={(e) => updateForm("age", e.target.value)} className="rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
              <input type="text" placeholder="학년" value={form.grade} onChange={(e) => updateForm("grade", e.target.value)} className="rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
            </div>
            <input type="text" placeholder="학과" value={form.department} onChange={(e) => updateForm("department", e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <input type="text" placeholder="MBTI" value={form.mbti} onChange={(e) => updateForm("mbti", e.target.value)} className="rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
              <input type="text" placeholder="생년 뒤 2자리" value={form.birth_year} onChange={(e) => updateForm("birth_year", e.target.value)} maxLength={2} className="rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
            </div>
            <input type="text" placeholder="만남 경위" value={form.meeting_reason} onChange={(e) => updateForm("meeting_reason", e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
            <textarea placeholder="특징" value={form.characteristics} onChange={(e) => updateForm("characteristics", e.target.value)} rows={3} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none resize-none" />
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{loading ? "등록 중..." : "생명 등록"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
