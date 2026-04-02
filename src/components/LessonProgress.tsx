"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Lesson {
  id: string;
  number: number;
  name: string;
  level: string;
  category: string;
  sort_order: number;
}

interface LessonCheck {
  id: string;
  lesson_id: string;
  attended_date: string | null;
  instructor_name: string | null;
  is_passed: boolean;
  note: string | null;
}

const LEVEL_LABELS: Record<string, string> = {
  intro: "입문",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

const LEVEL_COLORS: Record<string, string> = {
  intro: "bg-blue-600",
  beginner: "bg-indigo-600",
  intermediate: "bg-purple-600",
  advanced: "bg-pink-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  lecture: "",
  prayer_edu: "기도 교육",
  worship_edu: "예배 교육",
  criticism_edu: "악평 교육(교리 비교)",
  history: "역사론",
};

interface LessonProgressProps {
  lifeId: string;
}

export default function LessonProgress({ lifeId }: LessonProgressProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [checks, setChecks] = useState<Map<string, LessonCheck>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ attended_date: "", instructor_name: "", note: "" });

  useEffect(() => {
    fetchData();
  }, [lifeId]);

  const fetchData = async () => {
    const [lessonRes, checkRes] = await Promise.all([
      supabase.from("lessons").select("*").order("sort_order"),
      supabase.from("lesson_checks").select("*").eq("life_id", lifeId),
    ]);

    if (lessonRes.data) setLessons(lessonRes.data);
    if (checkRes.data) {
      const map = new Map<string, LessonCheck>();
      checkRes.data.forEach((c: LessonCheck) => map.set(c.lesson_id, c));
      setChecks(map);
    }
    setLoading(false);
  };

  const handleCheck = async (lessonId: string) => {
    const existing = checks.get(lessonId);
    if (existing) {
      // 이미 체크됨 → 체크 해제
      await supabase.from("lesson_checks").delete().eq("id", existing.id);
    } else {
      // 체크
      await supabase.from("lesson_checks").insert({
        life_id: lifeId,
        lesson_id: lessonId,
        attended_date: new Date().toISOString().split("T")[0],
      });
    }
    fetchData();
  };

  const handlePass = async (lessonId: string) => {
    const existing = checks.get(lessonId);
    if (existing) {
      await supabase.from("lesson_checks").update({ is_passed: !existing.is_passed }).eq("id", existing.id);
    } else {
      await supabase.from("lesson_checks").insert({
        life_id: lifeId,
        lesson_id: lessonId,
        is_passed: true,
      });
    }
    fetchData();
  };

  const openEdit = (lessonId: string) => {
    const check = checks.get(lessonId);
    setEditForm({
      attended_date: check?.attended_date || new Date().toISOString().split("T")[0],
      instructor_name: check?.instructor_name || "",
      note: check?.note || "",
    });
    setEditingId(lessonId);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const existing = checks.get(editingId);
    if (existing) {
      await supabase.from("lesson_checks").update({
        attended_date: editForm.attended_date || null,
        instructor_name: editForm.instructor_name || null,
        note: editForm.note || null,
      }).eq("id", existing.id);
    } else {
      await supabase.from("lesson_checks").insert({
        life_id: lifeId,
        lesson_id: editingId,
        attended_date: editForm.attended_date || null,
        instructor_name: editForm.instructor_name || null,
        note: editForm.note || null,
      });
    }
    setEditingId(null);
    fetchData();
  };

  if (loading) {
    return <p className="text-xs text-gray-400 text-center py-4">로딩 중...</p>;
  }

  // 레벨별 그룹핑
  const totalLectures = lessons.filter((l) => l.category === "lecture").length;
  const checkedLectures = lessons.filter((l) => l.category === "lecture" && checks.has(l.id)).length;

  let currentLevel = "";

  return (
    <div className="space-y-1">
      {/* 진행률 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${totalLectures ? (checkedLectures / totalLectures) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 shrink-0">{checkedLectures}/{totalLectures}</span>
      </div>

      {lessons.map((lesson) => {
        const check = checks.get(lesson.id);
        const isChecked = !!check;
        const isPassed = check?.is_passed || false;
        const isSpecial = lesson.category !== "lecture";
        const showLevelHeader = !isSpecial && LEVEL_LABELS[lesson.level] && lesson.level !== currentLevel;

        if (showLevelHeader) currentLevel = lesson.level;

        return (
          <div key={lesson.id}>
            {/* 레벨 구분 헤더 */}
            {showLevelHeader && (
              <div className={`${LEVEL_COLORS[lesson.level]} text-white text-xs font-bold px-3 py-1.5 rounded-t mt-3`}>
                {LEVEL_LABELS[lesson.level]}
              </div>
            )}

            {/* 특수 과정 구분 */}
            {isSpecial && (
              <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-t mt-3">
                {CATEGORY_LABELS[lesson.category] || lesson.name}
              </div>
            )}

            {/* 강의 행 */}
            <div className={`flex items-center gap-2 px-3 py-2 border-x border-b border-gray-200 ${
              isChecked ? "bg-green-50" : "bg-white"
            } ${isPassed ? "bg-yellow-50" : ""}`}>
              {/* 체크 버튼 */}
              <button
                onClick={() => handleCheck(lesson.id)}
                className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  isChecked
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-gray-300 hover:border-green-400"
                }`}
              >
                {isChecked && <span className="text-xs">✓</span>}
              </button>

              {/* 강의 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!isSpecial && (
                    <span className="text-[11px] text-gray-400 shrink-0">{lesson.number}.</span>
                  )}
                  <span className={`text-sm truncate ${isChecked ? "text-gray-500 line-through" : "text-gray-800"}`}>
                    {isSpecial ? CATEGORY_LABELS[lesson.category] || lesson.name : lesson.name}
                  </span>
                  {isPassed && (
                    <span className="text-[10px] bg-yellow-200 text-yellow-700 px-1.5 py-0.5 rounded-full shrink-0">패스</span>
                  )}
                </div>
                {check?.attended_date && (
                  <span className="text-[10px] text-gray-400">
                    {check.attended_date} {check.instructor_name ? `· ${check.instructor_name}` : ""}
                    {check.note ? ` · ${check.note}` : ""}
                  </span>
                )}
              </div>

              {/* 패스 / 상세 버튼 */}
              <button
                onClick={() => handlePass(lesson.id)}
                className={`text-[10px] px-2 py-1 rounded border shrink-0 ${
                  isPassed
                    ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                    : "border-gray-200 text-gray-400 hover:border-yellow-300"
                }`}
              >
                패스
              </button>
              <button
                onClick={() => openEdit(lesson.id)}
                className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-blue-300 shrink-0"
              >
                상세
              </button>
            </div>
          </div>
        );
      })}

      {/* 상세 편집 모달 */}
      {editingId && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setEditingId(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">강의 상세 기록</h3>
            <div>
              <label className="text-xs text-gray-500">수강일</label>
              <input
                type="date"
                value={editForm.attended_date}
                onChange={(e) => setEditForm((f) => ({ ...f, attended_date: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">강의자</label>
              <input
                type="text"
                placeholder="강의자 이름"
                value={editForm.instructor_name}
                onChange={(e) => setEditForm((f) => ({ ...f, instructor_name: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">비고</label>
              <input
                type="text"
                placeholder="메모"
                value={editForm.note}
                onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm mt-1"
              />
            </div>
            <button
              onClick={saveEdit}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
