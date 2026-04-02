"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Stats {
  total: number;
  preVisit: number;
  inLecture: number;
  completed: number;
  failed: number;
}

interface StageCounts {
  first_meeting: number;
  pre_visit: number;
  intro: number;
  beginner: number;
  intermediate: number;
  advanced: number;
  completed: number;
}

interface StuckLife {
  id: string;
  name: string;
  stage: string;
  last_met_at: string | null;
  updated_at: string;
  days_stuck: number;
}

interface StudentPerformance {
  display_name: string;
  total: number;
  active: number;
  failed: number;
}

const STAGE_LABELS: Record<string, string> = {
  first_meeting: "1차 만남",
  pre_visit: "전초",
  intro: "입문",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
  completed: "수료",
};

const STAGE_BAR_COLORS: Record<string, string> = {
  first_meeting: "bg-red-400",
  pre_visit: "bg-orange-400",
  intro: "bg-amber-400",
  beginner: "bg-yellow-400",
  intermediate: "bg-blue-400",
  advanced: "bg-teal-400",
  completed: "bg-green-400",
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, preVisit: 0, inLecture: 0, completed: 0, failed: 0 });
  const [stageCounts, setStageCounts] = useState<StageCounts>({
    first_meeting: 0, pre_visit: 0, intro: 0, beginner: 0, intermediate: 0, advanced: 0, completed: 0,
  });
  const [stuckLives, setStuckLives] = useState<StuckLife[]>([]);
  const [studentPerf, setStudentPerf] = useState<StudentPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    // 모든 생명
    const { data: lives } = await supabase.from("lives").select("id, name, stage, is_failed, last_met_at, updated_at");

    if (!lives) { setLoading(false); return; }

    // 상단 요약 카드
    const active = lives.filter((l) => !l.is_failed);
    const failed = lives.filter((l) => l.is_failed);
    const preVisit = active.filter((l) => l.stage === "pre_visit");
    const inLecture = active.filter((l) => ["intro", "beginner", "intermediate", "advanced"].includes(l.stage));
    const completed = active.filter((l) => l.stage === "completed");

    setStats({
      total: active.length,
      preVisit: preVisit.length,
      inLecture: inLecture.length,
      completed: completed.length,
      failed: failed.length,
    });

    // 단계별 카운트
    const counts: any = { first_meeting: 0, pre_visit: 0, intro: 0, beginner: 0, intermediate: 0, advanced: 0, completed: 0 };
    active.forEach((l) => { if (counts[l.stage] !== undefined) counts[l.stage]++; });
    setStageCounts(counts);

    // 병목 (30일 이상 업데이트 없는 활성 생명)
    const now = new Date();
    const stuck: StuckLife[] = active
      .map((l) => {
        const lastDate = l.last_met_at || l.updated_at;
        const days = Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
        return { ...l, days_stuck: days };
      })
      .filter((l) => l.days_stuck >= 14)
      .sort((a, b) => b.days_stuck - a.days_stuck)
      .slice(0, 10);
    setStuckLives(stuck);

    // 대학생별 성과
    const { data: students } = await supabase
      .from("users")
      .select("id, display_name")
      .eq("role", "student");

    const { data: userLives } = await supabase
      .from("user_lives")
      .select("user_id, life_id")
      .eq("role_in_life", "evangelist");

    if (students && userLives) {
      const lifeMap = new Map(lives.map((l) => [l.id, l]));
      const perf: StudentPerformance[] = students.map((s) => {
        const myLifeIds = userLives.filter((ul) => ul.user_id === s.id).map((ul) => ul.life_id);
        const myLives = myLifeIds.map((id) => lifeMap.get(id)).filter(Boolean);
        return {
          display_name: s.display_name,
          total: myLives.length,
          active: myLives.filter((l: any) => !l.is_failed).length,
          failed: myLives.filter((l: any) => l.is_failed).length,
        };
      }).sort((a, b) => b.active - a.active);
      setStudentPerf(perf);
    }

    setLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-500">로딩 중...</p></div>;
  }

  const maxStageCount = Math.max(...Object.values(stageCounts), 1);

  return (
    <div className="space-y-4">
      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
        <SummaryCard label="전체" value={stats.total} color="bg-blue-500" />
        <SummaryCard label="전초" value={stats.preVisit} color="bg-orange-500" />
        <SummaryCard label="강의중" value={stats.inLecture} color="bg-purple-500" />
        <SummaryCard label="수료" value={stats.completed} color="bg-green-500" />
        <SummaryCard label="페일" value={stats.failed} color="bg-gray-400" />
      </div>

      {/* 단계별 퍼널 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">단계별 현황</h3>
        <div className="space-y-2">
          {Object.entries(STAGE_LABELS).map(([key, label]) => {
            const count = stageCounts[key as keyof StageCounts] || 0;
            const width = (count / maxStageCount) * 100;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-16 shrink-0 text-right">{label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STAGE_BAR_COLORS[key]}`}
                    style={{ width: `${width}%` }}
                  />
                  {count > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium text-gray-700">
                      {count}명
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 병목 알림 */}
      {stuckLives.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <h3 className="text-sm font-bold text-red-600 mb-3">병목 알림 (14일+ 정체)</h3>
          <div className="space-y-1.5">
            {stuckLives.map((l) => (
              <div key={l.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{l.name}</span>
                  <span className="text-xs text-gray-400">{STAGE_LABELS[l.stage]}</span>
                </div>
                <span className="text-xs text-red-500 font-medium">{l.days_stuck}일</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 대학생별 성과 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-bold text-gray-700 mb-3">대학생별 성과</h3>
        <div className="space-y-1.5">
          {studentPerf.map((s) => (
            <div key={s.display_name} className="flex items-center justify-between text-sm">
              <span className="font-medium">{s.display_name}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-blue-600">활성 {s.active}</span>
                {s.failed > 0 && <span className="text-red-400">페일 {s.failed}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`${color} rounded-lg p-3 text-white text-center`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs opacity-80">{label}</p>
    </div>
  );
}
