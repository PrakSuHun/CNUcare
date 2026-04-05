"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";

export default function FeedbackPage() {
  const params = useParams();
  const formId = params.id as string;

  const [form, setForm] = useState<any>(null);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const fetchForm = async () => {
      const { data } = await supabase
        .from("event_feedback_forms")
        .select("*, events(name)")
        .eq("id", formId)
        .single();
      if (data) {
        setForm(data);
        setEventName((data.events as any)?.name || "");
        const init: Record<string, string> = {};
        (data.questions as string[]).forEach((q: string) => { init[q] = ""; });
        setAnswers(init);
      }
      setLoading(false);
    };
    fetchForm();
  }, [formId]);

  const handleSubmit = async () => {
    if (!form) return;
    if (!form.is_anonymous && !name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    const hasAnswer = Object.values(answers).some((a) => a.trim());
    if (!hasAnswer) {
      alert("최소 한 개 이상 답변해주세요.");
      return;
    }
    setSubmitting(true);
    await supabase.from("event_feedback_responses").insert({
      form_id: formId,
      respondent_name: form.is_anonymous ? null : name.trim(),
      answers,
    });
    setSubmitting(false);
    setDone(true);
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  if (!form) {
    return <div className="flex h-full items-center justify-center"><p className="text-gray-500">피드백을 찾을 수 없습니다.</p></div>;
  }

  if (done) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-4xl">✓</div>
          <p className="text-lg font-bold text-gray-800">피드백 감사합니다!</p>
          <p className="text-sm text-gray-500">{eventName}</p>
        </div>
      </div>
    );
  }

  const questions = form.questions as string[];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4 text-center shrink-0">
        <h1 className="text-lg font-bold">{eventName}</h1>
        <p className="text-xs text-gray-500">행사 피드백</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!form.is_anonymous && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력해주세요"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base"
            />
          </div>
        )}

        {questions.map((q) => (
          <div key={q}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{q}</label>
            <textarea
              value={answers[q] || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q]: e.target.value }))}
              placeholder="자유롭게 작성해주세요"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base resize-y"
            />
          </div>
        ))}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white rounded-lg py-3 text-base font-semibold disabled:opacity-50"
        >
          {submitting ? "제출 중..." : "제출하기"}
        </button>
      </div>
    </div>
  );
}
