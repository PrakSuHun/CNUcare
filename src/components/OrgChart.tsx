"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
  memo?: string | null;
  has_unread?: boolean;
  date_label?: string; // 조직도에 표시할 날짜 텍스트
  date_is_upcoming?: boolean; // 예정 약속 여부
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tree, setTree] = useState<ManagerNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [stageFilter, setStageFilter] = useState(() => searchParams.get("stage") || "");
  const [showAll, setShowAll] = useState(() => {
    const v = searchParams.get("all");
    if (v === "1") return true;
    if (v === "0") return false;
    return userRole === "instructor";
  });
  const [managerFilter, setManagerFilter] = useState(() => searchParams.get("mgr") || "");

  // 필터 상태 변경 시 URL 쿼리에 반영 (뒤로가기 시 복원됨)
  useEffect(() => {
    const p = new URLSearchParams();
    if (searchQuery) p.set("q", searchQuery);
    if (stageFilter) p.set("stage", stageFilter);
    if (showAll !== (userRole === "instructor")) p.set("all", showAll ? "1" : "0");
    if (managerFilter) p.set("mgr", managerFilter);
    const qs = p.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    router.replace(url, { scroll: false });
  }, [searchQuery, stageFilter, showAll, managerFilter, pathname, router, userRole]);
  const [editMode, setEditMode] = useState(false);
  const isEditing = externalEditMode !== undefined ? externalEditMode : editMode;
  const [movingStudent, setMovingStudent] = useState<{ id: string; name: string } | null>(null);
  const [movingLife, setMovingLife] = useState<{ id: string; name: string; fromStudentId: string } | null>(null);
  const [selectedLives, setSelectedLives] = useState<Set<string>>(new Set());
  const [movingSelectedTo, setMovingSelectedTo] = useState(false);

  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    fetchOrgData();
  }, []);

  // 전체 읽음 처리
  const markAllRead = async () => {
    const currentUser = getUser();
    if (!currentUser) return;

    let myLifeIds: string[] = [];
    if (userRole === "manager") {
      const { data: myStudents } = await supabase
        .from("users")
        .select("id")
        .eq("role", "student")
        .eq("manager_id", currentUser.id);
      const studentIds = (myStudents || []).map((s: any) => s.id);
      const ownerIds = [currentUser.id, ...studentIds];
      const { data: ownedLives } = await supabase
        .from("lives")
        .select("id")
        .in("primary_user_id", ownerIds);
      myLifeIds = (ownedLives || []).map((l: any) => l.id);
    } else {
      const { data: ownedLives } = await supabase
        .from("lives")
        .select("id")
        .eq("primary_user_id", currentUser.id);
      myLifeIds = (ownedLives || []).map((l: any) => l.id);
    }

    if (myLifeIds.length === 0) {
      fetchOrgData();
      return;
    }

    const { data: unread } = await supabase
      .from("journals")
      .select("id, read_by")
      .is("deleted_at", null)
      .in("life_id", myLifeIds);

    if (!unread) return;
    const toUpdate = unread.filter((j: any) => !(j.read_by || []).includes(currentUser.id));
    for (const j of toUpdate.slice(0, 200)) {
      const readBy = [...(j.read_by || []), currentUser.id];
      await supabase.from("journals").update({ read_by: readBy }).eq("id", j.id);
    }
    fetchOrgData();
  };

  const fetchOrgData = async () => {
    // 최초 3개 쿼리 병렬 실행
    const [managersRes, studentsRes, livesRes] = await Promise.all([
      supabase.from("users").select("id, display_name").eq("role", "manager").order("display_name"),
      supabase.from("users").select("id, display_name, manager_id").eq("role", "student").order("display_name"),
      supabase
        .from("lives")
        .select("id, name, age, department, stage, is_failed, last_met_at, memo, primary_user_id, created_at")
        .eq("is_failed", false),
    ]);
    const managers = managersRes.data;
    const students = studentsRes.data;
    const livesList = livesRes.data;

    // 담당자 맵: life_id → primary_user_id (담당자 없으면 제외)
    const firstOwner = new Map<string, string>();
    (livesList || []).forEach((l: any) => {
      if (l.primary_user_id) firstOwner.set(l.id, l.primary_user_id);
    });

    const currentUser = getUser();
    const currentUserId = currentUser?.id || "";

    // 관리자만 알림 표시 (자기 소속 대학생의 생명만)
    const unreadLifeIds = new Set<string>();
    if (userRole === "manager") {
      const myStudentIds = new Set(
        (students || []).filter((s) => s.manager_id === userId).map((s) => s.id)
      );
      // 내가 담당(직접 관리)하거나 내 소속 대학생이 담당하는 생명
      const myLifeIdArr = (livesList || [])
        .filter((l: any) => l.primary_user_id === userId || myStudentIds.has(l.primary_user_id))
        .map((l: any) => l.id);
      if (myLifeIdArr.length > 0) {
        const { data: recentJournals } = await supabase
          .from("journals")
          .select("life_id, read_by")
          .is("deleted_at", null)
          .in("life_id", myLifeIdArr)
          .order("created_at", { ascending: false });

        recentJournals?.forEach((j: any) => {
          const readBy = j.read_by || [];
          if (!readBy.includes(currentUserId)) {
            unreadLifeIds.add(j.life_id);
          }
        });
      }
    }

    // 약속 + 일지 날짜 조회 (병렬)
    const allLifeIds = [...firstOwner.keys()];
    const safeIds = allLifeIds.length > 0 ? allLifeIds : ["_"];
    const [{ data: appointments }, { data: latestJournals }] = await Promise.all([
      supabase.from("appointments").select("life_id, date, time").in("life_id", safeIds).order("date", { ascending: false }),
      supabase.from("journals").select("life_id, met_date").in("life_id", safeIds).is("deleted_at", null).order("met_date", { ascending: false }),
    ]);

    // 생명별 등록일 (lives.created_at)
    const lifeCreatedAt = new Map<string, string>();
    const livesById = new Map<string, any>();
    (livesList || []).forEach((l: any) => {
      lifeCreatedAt.set(l.id, l.created_at);
      livesById.set(l.id, l);
    });

    // 생명별 최신 일지 날짜
    const lifeLastJournal = new Map<string, string>();
    (latestJournals || []).forEach((j: any) => {
      if (!lifeLastJournal.has(j.life_id)) {
        lifeLastJournal.set(j.life_id, j.met_date);
      }
    });

    const today = new Date().toISOString().split("T")[0];
    // 4일 전 날짜 계산
    const fourDaysBefore = new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0];

    // 생명별 "예정" 표시 여부 계산
    // 규칙: 약속일 4일 전~당일까지만 "예정" 표시, 단 약속일 이후 일지가 있으면 해제
    const lifeDateInfo = new Map<string, { label: string; upcoming: boolean }>();
    allLifeIds.forEach((lifeId) => {
      const lifeAppts = (appointments || []).filter((a: any) => a.life_id === lifeId);
      const lastJournal = lifeLastJournal.get(lifeId);

      // 가장 가까운 미래 약속 (오늘 포함)
      const nextAppt = lifeAppts
        .filter((a: any) => a.date >= today)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))[0];

      if (nextAppt && nextAppt.date >= fourDaysBefore) {
        // 약속이 4일 이내에 있음
        // 약속 당일 이후 일지가 있으면 → 예정 해제 (일지 날짜로 표시)
        if (lastJournal && lastJournal >= nextAppt.date) {
          // 일지가 약속 당일 이후에 작성됨 → 예정 아님
        } else {
          lifeDateInfo.set(lifeId, { label: nextAppt.date, upcoming: true });
        }
      }
      // 약속 4일 이상 남았거나 없으면 → lifeDateInfo에 안 넣음 → 아래에서 일지 날짜 사용
    });

    const livesMap = new Map<string, LifeItem[]>();
    firstOwner.forEach((ownerId, lifeId) => {
      const lifeRow = livesById.get(lifeId);
      if (!lifeRow) return;
      const list = livesMap.get(ownerId) || [];

      // 날짜 라벨 결정: 약속 > 일지 최신 met_date > 등록일
      const apptInfo = lifeDateInfo.get(lifeId);
      let dateLabel = "";
      let dateIsUpcoming = false;
      if (apptInfo) {
        dateLabel = apptInfo.label;
        dateIsUpcoming = apptInfo.upcoming;
      } else if (lifeLastJournal.has(lifeId)) {
        dateLabel = lifeLastJournal.get(lifeId)!;
      } else {
        dateLabel = (lifeCreatedAt.get(lifeId) || "").split("T")[0];
      }

      const life = {
        id: lifeRow.id,
        name: lifeRow.name,
        age: lifeRow.age,
        department: lifeRow.department,
        stage: lifeRow.stage,
        is_failed: lifeRow.is_failed,
        last_met_at: lifeRow.last_met_at,
        memo: lifeRow.memo,
        has_unread: unreadLifeIds.has(lifeId),
        date_label: dateLabel,
        date_is_upcoming: dateIsUpcoming,
      };
      list.push(life);
      livesMap.set(ownerId, list);
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

  // 선택 토글
  const toggleSelectLife = (lifeId: string) => {
    setSelectedLives((prev) => {
      const next = new Set(prev);
      if (next.has(lifeId)) next.delete(lifeId);
      else next.add(lifeId);
      return next;
    });
  };

  // 선택된 생명 일괄 삭제
  const deleteSelectedLives = async () => {
    if (selectedLives.size === 0) return;
    if (!confirm(`선택한 ${selectedLives.size}명의 생명을 삭제하시겠습니까?\n(모든 일지, 강의 기록이 삭제되며 복구할 수 없습니다)`)) return;

    try {
      for (const lifeId of selectedLives) {
        await supabase.from("journals").delete().eq("life_id", lifeId);
        await supabase.from("lesson_checks").delete().eq("life_id", lifeId);
        await supabase.from("worship_attendance").delete().eq("life_id", lifeId);
        await supabase.from("bible_reading").delete().eq("life_id", lifeId);
        await supabase.from("audio_queue").delete().eq("life_id", lifeId);
        await supabase.from("user_lives").delete().eq("life_id", lifeId);
        await supabase.from("lives").delete().eq("id", lifeId);
      }
    } catch (e: any) {
      alert("삭제 실패: " + (e?.message || "알 수 없는 오류"));
    }

    setSelectedLives(new Set());
    fetchOrgData();
  };

  // 선택된 생명 일괄 담당자 변경 (lives.primary_user_id + 새 담당자 user_lives 연결 추가)
  const moveSelectedToStudent = async (toStudentId: string) => {
    if (selectedLives.size === 0) {
      alert("이동할 생명을 먼저 선택하세요.");
      return;
    }
    try {
      const lifeIds = [...selectedLives];
      const { error: updErr } = await supabase.from("lives")
        .update({ primary_user_id: toStudentId })
        .in("id", lifeIds);
      if (updErr) throw updErr;
      // 새 담당자에게 user_lives 연결도 보장 (기존 연결자들은 그대로)
      const ulRows = lifeIds.map((lifeId) => ({
        user_id: toStudentId,
        life_id: lifeId,
        role_in_life: "evangelist",
      }));
      await supabase.from("user_lives").upsert(ulRows, { onConflict: "user_id,life_id", ignoreDuplicates: true });
      setSelectedLives(new Set());
      setMovingSelectedTo(false);
      fetchOrgData();
    } catch (e: any) {
      alert("이동 실패: " + (e?.message || "알 수 없는 오류"));
    }
  };

  // 대학생을 다른 관리자로 이동
  const moveStudentToManager = async (studentId: string, newManagerId: string) => {
    await supabase.from("users").update({ manager_id: newManagerId }).eq("id", studentId);
    setMovingStudent(null);
    fetchOrgData();
  };

  // 생명 담당자 변경 (lives.primary_user_id + 새 담당자 user_lives 연결 추가)
  const moveLifeToStudent = async (lifeId: string, _fromStudentId: string, toUserId: string) => {
    try {
      const { error: updErr } = await supabase.from("lives")
        .update({ primary_user_id: toUserId })
        .eq("id", lifeId);
      if (updErr) throw updErr;
      await supabase.from("user_lives").upsert({
        user_id: toUserId,
        life_id: lifeId,
        role_in_life: "evangelist",
      }, { onConflict: "user_id,life_id", ignoreDuplicates: true });
      setMovingLife(null);
      fetchOrgData();
    } catch (e: any) {
      alert("이동 실패: " + (e?.message || "알 수 없는 오류"));
    }
  };

  // 이동 대상 목록: 관리자 + 대학생
  const allMoveTargets = [
    // 관리자
    ...visibleTree.map((m) => ({
      id: m.id,
      display_name: m.display_name,
      lives: [] as LifeItem[],
      managerName: "관리자",
      isManager: true,
    })),
    // 대학생
    ...visibleTree.flatMap((m) =>
      m.students
        .filter((s) => !s.id.endsWith("_direct"))
        .map((s) => ({ ...s, managerName: m.display_name, isManager: false }))
    ),
  ];

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
                  selectedLives={selectedLives}
                  onToggleSelect={toggleSelectLife}
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
              editMode={isEditing}
              onMoveStudent={(id, name) => setMovingStudent({ id, name })}
              onMoveLife={(id, name, fromId) => setMovingLife({ id, name, fromStudentId: fromId })}
              selectedLives={selectedLives}
              onToggleSelect={toggleSelectLife}
            />
          );
        })
      )}

      {/* 편집 모드 하단 도구 바 */}
      {isEditing && selectedLives.size > 0 && !movingSelectedTo && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40 p-3 flex items-center justify-between">
          <span className="text-sm font-medium text-blue-600">{selectedLives.size}명 선택됨</span>
          <div className="flex gap-2">
            <button
              onClick={() => setMovingSelectedTo(true)}
              className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              이동
            </button>
            <button
              onClick={deleteSelectedLives}
              className="text-sm bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
            >
              삭제
            </button>
            <button
              onClick={() => setSelectedLives(new Set())}
              className="text-sm text-gray-500 border border-gray-300 px-4 py-2 rounded-lg"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 선택된 생명 이동 대상 선택 모달 */}
      {movingSelectedTo && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold">{selectedLives.size}명을 이동할 대상 선택</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allMoveTargets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => moveSelectedToStudent(s.id)}
                  style={{ touchAction: "manipulation" }}
                  className="w-full text-left rounded-lg border border-gray-200 px-4 py-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <span className="text-sm font-medium">{s.display_name}</span>
                  <span className={`text-xs ml-2 ${s.isManager ? "text-yellow-600" : "text-gray-400"}`}>
                    {s.isManager ? "관리자" : s.managerName + " 소속"}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setMovingSelectedTo(false)} className="w-full text-center text-sm text-gray-500 py-2">취소</button>
          </div>
        </div>
      )}

      {/* 대학생 이동 모달 */}
      {movingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold">대학생 이동: {movingStudent.name}</h3>
            <p className="text-xs text-gray-500">어느 관리자 밑으로 이동할까요?</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {tree.filter((m) => m.id !== "unassigned").map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => moveStudentToManager(movingStudent.id, m.id)}
                  style={{ touchAction: "manipulation" }}
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
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold">생명 이동: {movingLife.name}</h3>
            <p className="text-xs text-gray-500">누구에게 이동할까요?</p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allMoveTargets.filter((s) => s.id !== movingLife.fromStudentId).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => moveLifeToStudent(movingLife.id, movingLife.fromStudentId, s.id)}
                  style={{ touchAction: "manipulation" }}
                  className="w-full text-left rounded-lg border border-gray-200 px-4 py-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <span className="text-sm font-medium">{s.display_name}</span>
                  <span className={`text-xs ml-2 ${s.isManager ? "text-yellow-600" : "text-gray-400"}`}>
                    {s.isManager ? "관리자" : s.managerName + " 소속"}
                  </span>
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
  editMode, onMoveStudent, onMoveLife, selectedLives, onToggleSelect,
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
  selectedLives: Set<string>;
  onToggleSelect: (lifeId: string) => void;
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
                      {editMode && (
                        <input
                          type="checkbox"
                          checked={selectedLives.has(life.id)}
                          onChange={() => onToggleSelect(life.id)}
                          className="w-4 h-4 shrink-0 accent-blue-600"
                        />
                      )}
                      <button
                        onClick={() => editMode ? onToggleSelect(life.id) : router.push(`${basePath}/life/${life.id}`)}
                        className={`flex-1 min-w-0 text-left rounded border px-2 py-1.5 transition-colors flex items-center gap-1.5 ${
                          editMode
                            ? selectedLives.has(life.id) ? "border-blue-400 bg-blue-50" : "border-gray-100 cursor-pointer"
                            : "border-gray-100 hover:bg-blue-50 hover:border-blue-300"
                        }`}
                      >
                        <span className={`text-sm font-medium whitespace-nowrap ${STAGE_NAME_COLORS[life.stage] || "text-gray-800"}`}>{life.name}</span>
                        {life.has_unread && <span className="w-2 h-2 bg-yellow-400 rounded-full shrink-0" />}
                        {life.age && <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">{life.age}세</span>}
                        {life.memo && (
                          <span className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 truncate min-w-0" title={life.memo}>
                            {life.memo}
                          </span>
                        )}
                        <span className="flex-1" />
                        {life.date_label && (
                          <span className={`text-[10px] font-medium shrink-0 whitespace-nowrap ${life.date_is_upcoming ? "text-blue-600" : "text-gray-700"}`}>
                            {formatDate(life.date_label)}{life.date_is_upcoming ? " 예정" : ""}
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap shrink-0 ${STAGE_COLORS[life.stage]}`}>
                          {STAGE_LABELS[life.stage]}
                        </span>
                      </button>
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
