"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface JournalFormProps {
  lifeId: string;
  journalId?: string; // 수정 모드일 때
  backPath: string;
}

export default function JournalForm({ lifeId, journalId, backPath }: JournalFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    met_date: new Date().toISOString().split("T")[0],
    location: "",
    response: "",
  });
  const [loading, setLoading] = useState(!!journalId);
  const [saving, setSaving] = useState(false);
  const isEdit = !!journalId;

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/"); return; }
    if (journalId) fetchJournal();
  }, [router, journalId]);

  const fetchJournal = async () => {
    const { data } = await supabase.from("journals").select("*").eq("id", journalId).single();
    if (data) {
      setForm({ met_date: data.met_date, location: data.location, response: data.response });
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (isEdit) {
      await supabase.from("journals").update({
        met_date: form.met_date,
        location: form.location,
        response: form.response,
      }).eq("id", journalId);
    } else {
      const user = getUser();
      if (!user) return;
      await supabase.from("journals").insert({
        life_id: lifeId,
        author_id: user.id,
        met_date: form.met_date,
        location: form.location,
        response: form.response,
      });
      await supabase.from("lives").update({ last_met_at: form.met_date }).eq("id", lifeId);
    }

    router.push(backPath);
  };

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => router.push(backPath)} className="text-gray-500 mr-3">&larr;</button>
        <h1 className="text-lg font-bold">{isEdit ? "일지 수정" : "일지 작성"}</h1>
      </header>
      <div className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
            <input type="date" value={form.met_date} onChange={(e) => setForm((f) => ({ ...f, met_date: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">만남 장소</label>
            <input type="text" placeholder="예: 학교 카페, 도서관 앞" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">생명 반응</label>
            <textarea placeholder="어떤 대화를 했는지, 생명의 반응은 어떠했는지, 다음 계획은 무엇인지 자유롭게 작성해주세요." value={form.response} onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))} required rows={8} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "저장 중..." : isEdit ? "수정 완료" : "일지 저장"}
          </button>
        </form>
      </div>
    </div>
  );
}
