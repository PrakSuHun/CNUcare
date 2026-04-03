"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { STAGE_LABELS, STAGE_COLORS, STAGE_NAME_COLORS, STAGE_ORDER } from "@/lib/stages";

interface LifeItem {
  id: string;
  name: string;
  age: number | null;
  department: string | null;
  stage: string;
  is_failed: boolean;
  last_met_at: string | null;
  has_unread?: boolean;
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

interface OrgChartProps {
  userRole: "manager" | "instructor";
  userId: string;
  basePath: string;
  editMode?: boolean;
}

export default function OrgChart({ userRole, userId, basePath, editMode: externalEditMode }: OrgChartProps) {
  const router = useRouter();
  const [tree, setTree] = useState<ManagerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showAll, setShowAll] = useState(userRole === "instructor");
  const [managerFilter, setManagerFilter] = useState("");
  const [editMode, setEditMode] = useState(false);
  const isEditing = externalEditMode !== undefined ? externalEditMode : editMode;
  const [movingStudent, setMovingStudent] = useState<{ id: string; name: string } | null>(null);
  const [movingLife, setMovingLife] = useState<{ id: string; name: string; fromStudentId: string } | null>(null);

  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    fetchOrgData();
  }, []);

  // 전체 읽음 처리
  const markAllRead = async () => {
    const currentUser = getUser();
    if (!currentUser) return;
    // 읽지 않은 일지에 현재 사용자 ID 추가
    const { data: unread } = await supabase
      .from("journals")
      .select("id, read_by")
      .is("deleted_at", null);

    if (!unread) return;
    const toUpdate = unread.filter((j: any) => !(j.read_by || []).includes(currentUser.id));
    for (const j of toUpdate.slice(0, 200)) {
      const readBy = [...(j.read_by || []), currentUser.id];
      await supabase.from("journals").update({ read_by: readBy }).eq("id", j.id);
    }
    fetchOrgData();
  };

  const fetchOrgData = async () => {
    const { data: managers } = await supabase
      .from("users").select("id, display_name").eq("role", "manager").order("display_name");

    const { data: students } = await supabase
      .from("users").select("id, display_name, manager_id").eq("role", "student").order("display_name");

    const { data: userLives } = await supabase
      .from("user_lives")
      .select("user_id, life_id, created_at, lives(id, name, age, department, stage, is_failed, last_met_at)")
      .order("created_at", { ascending: true });

    // 생명당 최초 등록자만 조직도에 표시 (중복 방지)
    const firstOwner = new Map<string, string>(); // life_id → first user_id
    userLives?.forEach((ul: any) => {
      if (!firstOwner.has(ul.life_id)) {
        firstOwner.set(ul.life_id, ul.user_id);
      }
    });

    // 현재 사용자
    const currentUser = getUser();
    const currentUserId = currentUser?.id || "";

    // 관리자만 알림 표시 (자기 소속 대학생의 생명만)
    const unreadLifeIds = new Set<string>();
    if (userRole === "manager") {
      // 자기 소속 대학생 ID 목록
      const myStudentIds = new Set(
        (students || []).filter((s) => s.manager_id === userId).map((s) => s.id)
      );
      // 소속 대학생의 생명 ID 목록
      const myLifeIds = new Set(
        (userLives || []).filter((ul: any) => myStudentIds.has(ul.user_id)).map((ul: any) => ul.life_id)
      );

      const { data: recentJournals } = await supabase
        .from("journals")
        .select("life_id, read_by")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(500);

      recentJournals?.forEach((j: any) => {
        if (!myLifeIds.has(j.life_id)) return; // 내 소속만
        const readBy = j.read_by || [];
        if (!readBy.includes(currentUserId)) {
          unreadLifeIds.add(j.life_id);
        }
      });
    }

    const livesMap = new Map<string, LifeItem[]>();
    userLives?.forEach((ul: any) => {
      if (!ul.lives) return;
      if (firstOwner.get(ul.life_id) !== ul.user_id) return;
      const list = livesMap.get(ul.user_id) || [];
      const life = { ...ul.lives, has_unread: unreadLifeIds.has(ul.life_id) };
      list.push(life);
      livesMap.set(ul.user_id, list);
    });

    // 정렬: 알림 있는 생명 먼저 → 단계 순
    livesMap.forEach((lives) => {
      lives.sort((a, b) => {
        if (a.has_unread && !b.has_unread) return -1;
        if (!a.has_unread && b.has_unread) return 1;
        return (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9);
      });
    });

    const studentMap = new Map<string, StudentNode[]>();
    students?.forEach((s) => {
      const mgrId = s.manager_id || "unassigned";
      const list = studentMap.get(mgrId) || [];
      const lives = livesMap.get(s.id) || [];
      list.push({ id: s.id, display_name: s.display_name, lives });
      studentMap.set(mgrId, list);
    });

    const treeData: ManagerNode[] = [];
    managers?.forEach((m) => {
      const mgrStudents = studentMap.get(m.id) || [];
      // 관리자 직접 관리 생명 추가
      const mgrLives = livesMap.get(m.id) || [];
      if (mgrLives.length > 0) {
        mgrLives.sort((a, b) => (STAGE_ORDER[a.stage] ?? 9) - (STAGE_ORDER[b.stage] ?? 9));
        mgrStudents.unshift({ id: m.id + "_direct", display_name: m.display_name + " (직접)", lives: mgrLives });
      }
      treeData.push({ id: m.id, display_name: m.display_name, students: mgrStudents });
    });

    const unassigned = studentMap.get("unassigned");
    if (unassigned && unassigned.length > 0) {
      treeData.push({ id: "unassigned", display_name: "미배정", students: unassigned });
    }

    setTree(treeData);
    setHasUnread(unreadLifeIds.size > 0);
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

  // 대학생을 다른 관리자로 이동
  const moveStudentToManager = async (studentId: string, newManagerId: string) => {
    await supabase.from("users").update({ manager_id: newManagerId }).eq("id", studentId);
    setMovingStudent(null);
    fetchOrgData();
  };

  // 생명을 다른 대학생으로 이동
  const moveLifeToStudent = async (lifeId: string, fromStudentId: string, toStudentId: string) => {
    // 기존 연결 삭제
    await supabase.from("user_lives").delete().eq("life_id", lifeId).eq("user_id", fromStudentId);
    // 새 연결 생성
    await supabase.from("user_lives").upsert({
      user_id: toStudentId,
      life_id: lifeId,
      role_in_life: "evangelist",
    });
    setMovingLife(null);
    fetchOrgData();
  };

  // 전체 대학생 목록 (이동 대상)
  const allStudents = tree.flatMap((m) => m.students.map((s) => ({ ...s, managerName: m.display_name })));

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
      {/* 전체 읽음 - 관리자만 */}
      {hasUnread && userRole === "manager" && (
        <button
          onClick={markAllRead}
          className="w-full rounded-lg bg-blue-50 border border-blue-200 py-2 text-center text-xs text-blue-600 hover:bg-blue-100 transition-colors"
        >
          새 업데이트 알림 전체 읽음 처리
        </button>
      )}

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
                  editMode={isEditing}
                  onMoveStudent={(id, name) => setMovingStudent({ id, name })}
                  onMoveLife={(id, name, fromId) => setMovingLife({ id, name, fromStudentId: fromId })}
                />
              );
            })}
          </div>
        </div>
      ) : (
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
              editMode={editMode}
              onMoveStudent={(id, name) => setMovingStudent({ id, name })}
              onMoveLife={(id, name, fromId) => setMovingLife({ id, name, fromStudentId: fromId })}
            />
          );
        })
      )}

      {/* 대학생 이동 모달 */}
      {movingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setMovingStudent(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">대학생 이동: {movingStudent.name}</h3>
            <p className="text-xs text-gray-500">어느 관리자 밑으로 이동할까요?</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tree.filter((m) => m.id !== "unassigned").map((m) => (
                <button
                  key={m.id}
                  onClick={() => moveStudentToManager(movingStudent.id, m.id)}
                  className="w-full text-left rounded-lg border border-gray-200 px-4 py-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <span className="text-sm font-medium">{m.display_name}</span>
                  <span className="text-xs text-gray-400 ml-2">대학생 {m.students.length}명</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMovingStudent(null)} className="w-full text-center text-sm text-gray-500 py-2">취소</button>
          </div>
        </div>
      )}

      {/* 생명 이동 모달 */}
      {movingLife && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setMovingLife(null)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">생명 이동: {movingLife.name}</h3>
            <p className="text-xs text-gray-500">어느 대학생에게 이동할까요?</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allStudents.filter((s) => s.id !== movingLife.fromStudentId).map((s) => (
                <button
                  key={s.id}
                  onClick={() => moveLifeToStudent(movingLife.id, movingLife.fromStudentId, s.id)}
                  className="w-full text-left rounded-lg border border-gray-200 px-4 py-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <span className="text-sm font-medium">{s.display_name}</span>
                  <span className="text-xs text-gray-400 ml-2">{s.managerName} 소속</span>
                </button>
              ))}
            </div>
            <button onClick={() => setMovingLife(null)} className="w-full text-center text-sm text-gray-500 py-2">취소</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* 통일된 관리자 컬럼 컴포넌트 */
function ManagerColumn({
  manager, visibleStudents, horizontal, searchQuery, stageFilter, filterLife, basePath, router, formatDate,
  editMode, onMoveStudent, onMoveLife,
}: {
  manager: ManagerNode;
  visibleStudents: StudentNode[];
  horizontal: boolean;
  searchQuery: string;
  stageFilter: string;
  filterLife: (life: LifeItem) => boolean;
  basePath: string;
  router: any;
  formatDate: (d: string | null) => string;
  editMode: boolean;
  onMoveStudent: (id: string, name: string) => void;
  onMoveLife: (id: string, name: string, fromStudentId: string) => void;
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
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400">{activeLives.length}명</span>
                    {editMode && (
                      <button
                        onClick={() => onMoveStudent(student.id, student.display_name)}
                        className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded hover:bg-orange-200"
                      >
                        이동
                      </button>
                    )}
                  </div>
                </div>
                {/* 생명 리스트 */}
                <div className="p-2 space-y-1">
                  {activeLives.length === 0 && failedLives.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-1">생명 없음</p>
                  )}
                  {activeLives.map((life) => (
                    <div key={life.id} className="flex items-center gap-1">
                      <button
                        onClick={() => !editMode && router.push(`${basePath}/life/${life.id}`)}
                        className={`flex-1 text-left rounded border border-gray-100 px-2 py-1.5 transition-colors flex items-center justify-between gap-2 ${
                          editMode ? "cursor-default" : "hover:bg-blue-50 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-medium truncate ${STAGE_NAME_COLORS[life.stage] || "text-gray-800"}`}>{life.name}</span>
                          {life.has_unread && (
                            <span className="w-2 h-2 bg-yellow-400 rounded-full shrink-0" />
                          )}
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
                      {editMode && (
                        <button
                          onClick={() => onMoveLife(life.id, life.name, student.id)}
                          className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-1 rounded hover:bg-orange-200 shrink-0"
                        >
                          이동
                        </button>
                      )}
                    </div>
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
