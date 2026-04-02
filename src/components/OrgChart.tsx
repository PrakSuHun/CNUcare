"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface LifeItem {
  id: string;
  name: string;
  age: number | null;
  department: string | null;
  stage: string;
  is_failed: boolean;
  last_met_at: string | null;
}

interface StudentNode {
  id: string;
  display_name: string;
  lives: LifeItem[];
}

interface ManagerNode {
  id: string;
  display_name: string;
  students: StudentNode[];
}

const STAGE_LABELS: Record<string, string> = {
  first_meeting: "1차",
  pre_visit: "전초",
  intro: "입문",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
  completed: "수료",
};

const STAGE_COLORS: Record<string, string> = {
  first_meeting: "bg-gray-200 text-gray-700",
  pre_visit: "bg-yellow-200 text-yellow-800",
  intro: "bg-blue-200 text-blue-800",
  beginner: "bg-indigo-200 text-indigo-800",
  intermediate: "bg-purple-200 text-purple-800",
  advanced: "bg-pink-200 text-pink-800",
  completed: "bg-green-200 text-green-800",
};

interface OrgChartProps {
  userRole: "manager" | "instructor";
  userId: string;
  basePath: string;
}

export default function OrgChart({ userRole, userId, basePath }: OrgChartProps) {
  const router = useRouter();
  const [tree, setTree] = useState<ManagerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showAll, setShowAll] = useState(userRole === "instructor");

  useEffect(() => {
    fetchOrgData();
  }, []);

  const fetchOrgData = async () => {
    const { data: managers } = await supabase
      .from("users").select("id, display_name").eq("role", "manager").order("display_name");

    const { data: students } = await supabase
      .from("users").select("id, display_name, manager_id").eq("role", "student").order("display_name");

    const { data: userLives } = await supabase
      .from("user_lives")
      .select("user_id, life_id, lives(id, name, age, department, stage, is_failed, last_met_at)")
      .eq("role_in_life", "evangelist");

    const livesMap = new Map<string, LifeItem[]>();
    userLives?.forEach((ul: any) => {
      if (!ul.lives) return;
      const list = livesMap.get(ul.user_id) || [];
      list.push(ul.lives);
      livesMap.set(ul.user_id, list);
    });

    const studentMap = new Map<string, StudentNode[]>();
    students?.forEach((s) => {
      const mgrId = s.manager_id || "unassigned";
      const list = studentMap.get(mgrId) || [];
      list.push({ id: s.id, display_name: s.display_name, lives: livesMap.get(s.id) || [] });
      studentMap.set(mgrId, list);
    });

    const treeData: ManagerNode[] = [];
    managers?.forEach((m) => {
      treeData.push({ id: m.id, display_name: m.display_name, students: studentMap.get(m.id) || [] });
    });

    const unassigned = studentMap.get("unassigned");
    if (unassigned && unassigned.length > 0) {
      treeData.push({ id: "unassigned", display_name: "미배정", students: unassigned });
    }

    setTree(treeData);
    setLoading(false);
  };

  // 관리자인 경우 자기 소속만 / 전체 보기 토글
  const visibleTree = showAll
    ? tree
    : tree.filter((m) => m.id === userId);

  const filterLife = (life: LifeItem) => {
    if (stageFilter && life.stage !== stageFilter) return false;
    if (searchQuery && !life.name.includes(searchQuery)) return false;
    return true;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "";
    return new Date(d).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-gray-500">로딩 중...</p></div>;
  }

  return (
    <div className="space-y-3">
      {/* 상단 컨트롤 */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* 관리자: 내 소속 / 전체 보기 토글 */}
        {userRole === "manager" && (
          <button
            onClick={() => setShowAll(!showAll)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showAll
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            {showAll ? "전체 보기" : "내 소속만"}
          </button>
        )}

        {/* 강사: 검색/필터 */}
        {userRole === "instructor" && (
          <>
            <input
              type="text"
              placeholder="생명 이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">전체</option>
              {Object.entries(STAGE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* 조직도 */}
      {visibleTree.map((manager) => {
        const hasFilteredLives = manager.students.some((s) => s.lives.some(filterLife));
        if ((searchQuery || stageFilter) && !hasFilteredLives) return null;

        // 관리자 내 대학생들을 필터링
        const visibleStudents = manager.students.filter((student) => {
          if (!searchQuery && !stageFilter) return true;
          return student.lives.some(filterLife);
        });

        return (
          <div key={manager.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* 관리자 헤더 */}
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-600">{manager.display_name}</span>
              <span className="text-xs text-gray-400">
                대학생 {visibleStudents.length}명 · 생명 {manager.students.reduce((s, st) => s + st.lives.filter((l) => !l.is_failed).length, 0)}명
              </span>
            </div>

            {/* 모바일: 세로 리스트 / PC: 가로 스크롤 카드 */}
            <div className="p-3 overflow-x-auto">
              <div className="flex flex-col lg:flex-row lg:gap-4 lg:min-w-max divide-y divide-gray-100 lg:divide-y-0">
                {visibleStudents.map((student) => {
                  const livesToShow = searchQuery || stageFilter
                    ? student.lives.filter(filterLife)
                    : student.lives;
                  const activeLives = livesToShow.filter((l) => !l.is_failed);
                  const failedLives = livesToShow.filter((l) => l.is_failed);

                  return (
                    <div
                      key={student.id}
                      className="py-2 lg:py-0 lg:min-w-[220px] lg:max-w-[280px] lg:border lg:border-gray-200 lg:rounded-lg lg:p-3 lg:bg-gray-50/50 shrink-0"
                    >
                      {/* 대학생 이름 */}
                      <div className="text-xs font-semibold text-gray-500 mb-1.5 lg:text-center lg:pb-1.5 lg:border-b lg:border-gray-200 lg:mb-2">
                        {student.display_name}
                        <span className="text-gray-300 ml-1">({activeLives.length})</span>
                      </div>

                      {activeLives.length === 0 && failedLives.length === 0 && (
                        <p className="text-xs text-gray-300 pl-1">생명 없음</p>
                      )}

                      {/* 생명 카드 - 모바일: 2열 / PC: 1열 */}
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                        {activeLives.map((life) => (
                          <button
                            key={life.id}
                            onClick={() => router.push(`${basePath}/life/${life.id}`)}
                            className="text-left rounded-md border border-gray-200 px-2.5 py-2 hover:bg-blue-50 hover:border-blue-300 transition-colors bg-white"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-sm font-medium truncate">{life.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium ${STAGE_COLORS[life.stage]}`}>
                                {STAGE_LABELS[life.stage]}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {life.age && <span className="text-[11px] text-gray-400">{life.age}세</span>}
                              {life.department && <span className="text-[11px] text-gray-400 truncate">{life.department}</span>}
                              {life.last_met_at && (
                                <span className="text-[11px] text-gray-300 ml-auto shrink-0">{formatDate(life.last_met_at)}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* 페일 */}
                      {failedLives.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {failedLives.map((life) => (
                            <button
                              key={life.id}
                              onClick={() => router.push(`${basePath}/life/${life.id}`)}
                              className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 hover:bg-gray-200"
                            >
                              {life.name} <span className="text-red-300">페일</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
