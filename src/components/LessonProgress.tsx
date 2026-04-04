"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { autoUpdateByLessons } from "@/lib/autoStage";

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
  is_passed: boolean;
}

interface JournalInfo {
  met_date: string;
  instructor_name: string | null;
  response: string | null;
}

const LEVEL_LABELS: Record<string, string> = {
  intro: "입문", beginner: "초급", intermediate: "중급", advanced: "고급",
};

const LEVEL_COLORS: Record<string, string> = {
  intro: "bg-blue-600", beginner: "bg-indigo-600", intermediate: "bg-purple-600", advanced: "bg-pink-600",
};

const CATEGORY_LABELS: Record<string, string> = {
  lecture: "", prayer_edu: "기도 교육", worship_edu: "예배 교육",
  criticism_edu: "악평 교육(교리 비교)", history: "역사론",
};

interface LessonProgressProps {
  lifeId: string;
}

export default function LessonProgress({ lifeId }: LessonProgressProps) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [checks, setChecks] = useState<Map<string, LessonCheck>>(new Map());
  const [journalMap, setJournalMap] = useState<Map<string, JournalInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [lifeId]);

  const fetchData = async () => {
    const [lessonRes, checkRes, journalRes] = await Promise.all([
      supabase.from("lessons").select("*").order("sort_order"),
      supabase.from("lesson_checks").select("id, lesson_id, is_passed").eq("life_id", lifeId),
      supabase.from("journals")
        .select("lesson_id, met_date, instructor_name, response")
        .eq("life_id", lifeId)
        .eq("purpose", "lecture")
        .is("deleted_at", null)
        .order("met_date", { ascending: false }),
    ]);

    if (lessonRes.data) setLessons(lessonRes.data);
    if (checkRes.data) {
      const map = new Map<string, LessonCheck>();
      checkRes.data.forEach((c: any) => map.set(c.lesson_id, c));
      setChecks(map);
    }
    if (journalRes.data) {
      const jMap = new Map<string, JournalInfo>();
      journalRes.data.forEach((j: any) => {
        if (j.lesson_id && !jMap.has(j.lesson_id)) {
          jMap.set(j.lesson_id, {
            met_date: j.met_date,
            instructor_name: j.instructor_name,
            response: j.response,
          });
        }
      });
      setJournalMap(jMap);
    }
    setLoading(false);
  };

  const handleCheck = async (lessonId: string) => {
    const existing = checks.get(lessonId);
    if (existing) {
      await supabase.from("lesson_checks").delete().eq("id", existing.id);
    } else {
      await supabase.from("lesson_checks").insert({
        life_id: lifeId,
        lesson_id: lessonId,
      });
    }
    await autoUpdateByLessons(lifeId);
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

  if (loading) return <p className="text-xs text-gray-400 text-center py-4">로딩 중...</p>;

  const totalLectures = lessons.filter((l) => l.category === "lecture").length;
  const checkedLectures = lessons.filter((l) => l.category === "lecture" && checks.has(l.id)).length;
  let currentLevel = "";

  return (
    <div className="space-y-1">
      {/* 진행률 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${totalLectures ? (checkedLectures / totalLectures) * 100 : 0}%` }} />
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

        const journal = journalMap.get(lesson.id);
        const isExpanded = expandedId === lesson.id;

        return (
          <div key={lesson.id}>
            {showLevelHeader && (
              <div className={`${LEVEL_COLORS[lesson.level]} text-white text-xs font-bold px-3 py-1.5 rounded-t mt-3`}>
                {LEVEL_LABELS[lesson.level]}
              </div>
            )}
            {isSpecial && (
              <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-t mt-3">
                {CATEGORY_LABELS[lesson.category] || lesson.name}
              </div>
            )}

            <div className={`border-x border-b border-gray-200 ${isChecked ? "bg-green-50" : "bg-white"} ${isPassed ? "bg-yellow-50" : ""}`}>
              {/* 강의 행 */}
              <div className="flex items-center gap-2 px-3 py-2">
                <button onClick={() => handleCheck(lesson.id)}
                  className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                    isChecked ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"
                  }`}>
                  {isChecked && <span className="text-xs">✓</span>}
                </button>

                <button onClick={() => setExpandedId(isExpanded ? null : lesson.id)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    {!isSpecial && <span className="text-[11px] text-gray-400 shrink-0">{lesson.number}.</span>}
                    <span className={`text-sm truncate ${isChecked ? "text-gray-500" : "text-gray-800"}`}>
                      {isSpecial ? CATEGORY_LABELS[lesson.category] || lesson.name : lesson.name}
                    </span>
                    {isPassed && <span className="text-[10px] bg-yellow-200 text-yellow-700 px-1.5 py-0.5 rounded-full shrink-0">패스</span>}
                    {journal && <span className="text-[10px] text-blue-400 shrink-0">일지</span>}
                  </div>
                  {/* 강사/날짜 요약 (일지에서) */}
                  {journal && !isExpanded && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400">{journal.met_date}</span>
                      {journal.instructor_name && <span className="text-[10px] text-gray-400">· {journal.instructor_name}</span>}
                    </div>
                  )}
                </button>

                <button onClick={() => handlePass(lesson.id)}
                  className={`text-[10px] px-2 py-1 rounded border shrink-0 ${
                    isPassed ? "bg-yellow-100 border-yellow-300 text-yellow-700" : "border-gray-200 text-gray-400 hover:border-yellow-300"
                  }`}>패스</button>
              </div>

              {/* 확장: 일지 상세 (읽기 전용) */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-100 mt-1 pt-2">
                  {journal ? (
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{journal.met_date}</span>
                        {journal.instructor_name && (
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">강사: {journal.instructor_name}</span>
                        )}
                      </div>
                      {journal.response && (
                        <div className="mt-2">
                          <p className="text-[10px] text-gray-400 mb-1">생명 반응</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{journal.response}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">강의 일지가 없습니다. 일지에서 강의를 선택하여 작성해주세요.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
