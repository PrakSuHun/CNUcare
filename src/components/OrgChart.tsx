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
  first_meeting: "1차 만남",
  pre_visit: "전초",
  intro: "입문",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
  completed: "수료",
};

const STAGE_COLORS: Record<string, string> = {
  first_meeting: "bg-gray-100 text-gray-600",
  pre_visit: "bg-yellow-100 text-yellow-700",
  intro: "bg-blue-100 text-blue-700",
  beginner: "bg-indigo-100 text-indigo-700",
  intermediate: "bg-purple-100 text-purple-700",
  advanced: "bg-pink-100 text-pink-700",
  completed: "bg-green-100 text-green-700",
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
  const [openManagers, setOpenManagers] = useState<Set<string>>(new Set());
  const [openStudents, setOpenStudents] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");

  useEffect(() => {
    fetchOrgData();
  }, []);

  const fetchOrgData = async () => {
    // 관리자 목록
    const { data: managers } = await supabase
      .from("users")
      .select("id, display_name")
      .eq("role", "manager")
      .order("display_name");

    // 대학생 목록 (manager_id 포함)
    const { data: students } = await supabase
      .from("users")
      .select("id, display_name, manager_id")
      .eq("role", "student")
      .order("display_name");

    // 모든 user_lives + lives
    const { data: userLives } = await supabase
      .from("user_lives")
      .select("user_id, life_id, lives(id, name, age, department, stage, is_failed, last_met_at)")
      .eq("role_in_life", "evangelist");

    // 트리 구성
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
      list.push({
        id: s.id,
        display_name: s.display_name,
        lives: livesMap.get(s.id) || [],
      });
      studentMap.set(mgrId, list);
    });

    const treeData: ManagerNode[] = [];
    managers?.forEach((m) => {
      treeData.push({
        id: m.id,
        display_name: m.display_name,
        students: studentMap.get(m.id) || [],
      });
    });

    // 미배정 대학생
    const unassigned = studentMap.get("unassigned");
    if (unassigned && unassigned.length > 0) {
      treeData.push({
        id: "unassigned",
        display_name: "미배정",
        students: unassigned,
      });
    }

    setTree(treeData);

    // 기본적으로 모든 관리자 펼치기
    setOpenManagers(new Set(treeData.map((m) => m.id)));
    setLoading(false);
  };

  const toggleManager = (id: string) => {
    setOpenManagers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStudent = (id: string) => {
    setOpenStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filterLife = (life: LifeItem) => {
    if (stageFilter && life.stage !== stageFilter) return false;
    if (searchQuery && !life.name.includes(searchQuery)) return false;
    return true;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 강사 전용: 검색/필터 */}
      {userRole === "instructor" && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="생명 이름 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">전체 단계</option>
            {Object.entries(STAGE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {/* 조직도 트리 */}
      {tree.map((manager) => {
        const isOpen = openManagers.has(manager.id);
        const totalLives = manager.students.reduce(
          (sum, s) => sum + s.lives.filter((l) => !l.is_failed).length,
          0
        );

        return (
          <div key={manager.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* 관리자 헤더 */}
            <button
              onClick={() => toggleManager(manager.id)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{isOpen ? "▼" : "▶"}</span>
                <span className="font-semibold text-sm">{manager.display_name}</span>
                <span className="text-xs text-gray-400">
                  대학생 {manager.students.length}명 · 생명 {totalLives}명
                </span>
              </div>
            </button>

            {/* 대학생 목록 */}
            {isOpen && (
              <div className="divide-y divide-gray-100">
                {manager.students.map((student) => {
                  const isStudentOpen = openStudents.has(student.id);
                  const filteredLives = student.lives.filter(filterLife);
                  const activeLives = filteredLives.filter((l) => !l.is_failed);

                  if (searchQuery || stageFilter) {
                    if (filteredLives.length === 0) return null;
                  }

                  return (
                    <div key={student.id}>
                      {/* 대학생 행 */}
                      <button
                        onClick={() => toggleStudent(student.id)}
                        className="w-full px-4 py-2.5 pl-8 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {isStudentOpen ? "▼" : "▶"}
                          </span>
                          <span className="text-sm font-medium">{student.display_name}</span>
                          <span className="text-xs text-gray-400">
                            {activeLives.length}명
                          </span>
                        </div>
                      </button>

                      {/* 생명 목록 */}
                      {isStudentOpen && (
                        <div className="bg-gray-50/50">
                          {(searchQuery || stageFilter ? filteredLives : student.lives).map((life) => (
                            <button
                              key={life.id}
                              onClick={() => router.push(`${basePath}/life/${life.id}`)}
                              className={`w-full px-4 py-2 pl-14 flex items-center justify-between hover:bg-blue-50 transition-colors text-left ${
                                life.is_failed ? "opacity-40" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-sm truncate">{life.name}</span>
                                {life.age && (
                                  <span className="text-xs text-gray-400 shrink-0">{life.age}세</span>
                                )}
                                {life.department && (
                                  <span className="text-xs text-gray-400 truncate">{life.department}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    life.is_failed
                                      ? "bg-red-100 text-red-500"
                                      : STAGE_COLORS[life.stage] || "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {life.is_failed ? "페일" : STAGE_LABELS[life.stage] || life.stage}
                                </span>
                                {life.last_met_at && (
                                  <span className="text-xs text-gray-400">
                                    {new Date(life.last_met_at).toLocaleDateString("ko-KR", {
                                      month: "2-digit",
                                      day: "2-digit",
                                    })}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                          {student.lives.length === 0 && (
                            <p className="text-xs text-gray-400 px-4 py-2 pl-14">생명 없음</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
