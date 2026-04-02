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
  const [managerFilter, setManagerFilter] = useState("");

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
      const lives = livesMap.get(s.id) || [];
      // 수료→고급→중급→초급→입문→전초→1차 순 정렬
      const stageOrder: Record<string, number> = {
        completed: 0, advanced: 1, intermediate: 2, beginner: 3,
        intro: 4, pre_visit: 5, first_meeting: 6,
      };
      lives.sort((a, b) => (stageOrder[a.stage] ?? 9) - (stageOrder[b.stage] ?? 9));
      list.push({ id: s.id, display_name: s.display_name, lives });
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

  // 표시할 트리 필터링
  const visibleTree = (() => {
    let filtered = tree;
    // 관리자: 내 소속만 / 전체
    if (userRole === "manager" && !showAll) {
      filtered = filtered.filter((m) => m.id === userId);
    }
    // 관리자별 필터
    if (managerFilter) {
      filtered = filtered.filter((m) => m.id === managerFilter);
    }
    return filtered;
  })();

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
            onClick={() => { setShowAll(!showAll); setManagerFilter(""); }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              showAll
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300"
            }`}
          >
            {showAll ? "전체 보기" : "내 소속만"}
          </button>
        )}

        {/* 검색 + 필터 (관리자, 강사 공통) */}
        <input
          type="text"
          placeholder="생명 이름 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[100px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
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

        {/* 관리자별 필터 (전체 보기 시 또는 강사) */}
        {(showAll || userRole === "instructor") && (
          <select
            value={managerFilter}
            onChange={(e) => setManagerFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">전체 관리자</option>
            {tree.map((m) => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* 조직도: 전체(관리자 가로) vs 단일(대학생 가로) */}
      {visibleTree.map((manager) => {
        const hasFilteredLives = manager.students.some((s) => s.lives.some(filterLife));
        if ((searchQuery || stageFilter) && !hasFilteredLives) return null;
        const visibleStudents = manager.students.filter((student) => {
          if (!searchQuery && !stageFilter) return true;
          return student.lives.some(filterLife);
        });
        return null; // 아래에서 렌더링
      })}

      {/* 전체 관리자 보기: 관리자 컬럼이 가로로 */}
      {showAll && !managerFilter ? (
        <div className="overflow-x-auto pb-2">
          <div className="flex flex-col lg:flex-row lg:items-start lg:gap-3 lg:min-w-max space-y-3 lg:space-y-0">
            {visibleTree.map((manager) => {
              const hasFilteredLives = manager.students.some((s) => s.lives.some(filterLife));
              if ((searchQuery || stageFilter) && !hasFilteredLives) return null;
              const visibleStudents = manager.students.filter((student) => {
                if (!searchQuery && !stageFilter) return true;
                return student.lives.some(filterLife);
              });
              return (
                <ManagerColumn
                  key={manager.id}
                  manager={manager}
                  visibleStudents={visibleStudents}
                  horizontal={false}
                  searchQuery={searchQuery}
                  stageFilter={stageFilter}
                  filterLife={filterLife}
                  basePath={basePath}
                  router={router}
                  formatDate={formatDate}
                />
              );
            })}
          </div>
        </div>
      ) : (
        /* 단일 관리자 보기: 대학생이 가로로 */
        visibleTree.map((manager) => {
          const hasFilteredLives = manager.students.some((s) => s.lives.some(filterLife));
          if ((searchQuery || stageFilter) && !hasFilteredLives) return null;
          const visibleStudents = manager.students.filter((student) => {
            if (!searchQuery && !stageFilter) return true;
            return student.lives.some(filterLife);
          });
          return (
            <ManagerColumn
              key={manager.id}
              manager={manager}
              visibleStudents={visibleStudents}
              horizontal={true}
              searchQuery={searchQuery}
              stageFilter={stageFilter}
              filterLife={filterLife}
              basePath={basePath}
              router={router}
              formatDate={formatDate}
            />
          );
        })
      )}
    </div>
  );
}

/* 통일된 관리자 컬럼 컴포넌트 */
function ManagerColumn({
  manager, visibleStudents, horizontal, searchQuery, stageFilter, filterLife, basePath, router, formatDate,
}: {
  manager: ManagerNode;
  visibleStudents: StudentNode[];
  horizontal: boolean; // true면 대학생이 가로 배치
  searchQuery: string;
  stageFilter: string;
  filterLife: (life: LifeItem) => boolean;
  basePath: string;
  router: any;
  formatDate: (d: string | null) => string;
}) {
  const totalLives = manager.students.reduce((s, st) => s + st.lives.filter((l) => !l.is_failed).length, 0);

  return (
    <div className={horizontal ? "" : "lg:w-[280px] shrink-0"}>
      {/* 관리자 헤더 - 통일 스타일 */}
      <div className="px-3 py-2 bg-gray-700 text-white rounded-t-lg flex items-center justify-between">
        <span className="text-xs font-bold">{manager.display_name}</span>
        <span className="text-xs text-gray-300">
          대학생 {visibleStudents.length}명 · 생명 {totalLives}명
        </span>
      </div>

      {/* 대학생 카드들 */}
      <div className={`bg-gray-100 rounded-b-lg p-2 overflow-x-auto ${
        horizontal
          ? ""
          : ""
      }`}>
        <div className={
          horizontal
            ? "flex flex-col lg:flex-row lg:gap-3 lg:min-w-max space-y-2 lg:space-y-0"
            : "space-y-2"
        }>
          {visibleStudents.map((student) => {
            const livesToShow = searchQuery || stageFilter ? student.lives.filter(filterLife) : student.lives;
            const activeLives = livesToShow.filter((l) => !l.is_failed);
            const failedLives = livesToShow.filter((l) => l.is_failed);

            return (
              <div
                key={student.id}
                className={`bg-white rounded-lg border border-gray-200 overflow-hidden shrink-0 ${
                  horizontal ? "lg:w-[250px]" : ""
                }`}
              >
                {/* 대학생 헤더 */}
                <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">{student.display_name}</span>
                  <span className="text-[10px] text-gray-400">{activeLives.length}명</span>
                </div>
                {/* 생명 리스트 */}
                <div className="p-2 space-y-1">
                  {activeLives.length === 0 && failedLives.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-1">생명 없음</p>
                  )}
                  {activeLives.map((life) => (
                    <button
                      key={life.id}
                      onClick={() => router.push(`${basePath}/life/${life.id}`)}
                      className="w-full text-left rounded border border-gray-100 px-2 py-1.5 hover:bg-blue-50 hover:border-blue-300 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{life.name}</span>
                        {life.age && <span className="text-[11px] text-gray-400 shrink-0">{life.age}세</span>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {life.last_met_at && (
                          <span className="text-[10px] text-gray-300">{formatDate(life.last_met_at)}</span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STAGE_COLORS[life.stage]}`}>
                          {STAGE_LABELS[life.stage]}
                        </span>
                      </div>
                    </button>
                  ))}
                  {failedLives.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
