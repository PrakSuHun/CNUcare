"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, logout, User } from "@/lib/auth";
import { STAGE_LABELS, STAGE_COLORS } from "@/lib/stages";
import InstructorCalendar from "@/components/InstructorCalendar";
import AdminViewBanner from "@/components/AdminViewBanner";
import EventList from "@/components/EventList";

interface Life {
  id: string;
  name: string;
  stage: string;
  is_failed: boolean;
  updated_at: string;
  memo: string | null;
}

export default function StudentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lives, setLives] = useState<Life[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuLifeId, setMenuLifeId] = useState<string | null>(null);
  const [tab, setTab] = useState<"lives" | "calendar" | "events">("lives");

  useEffect(() => {
    const u = getUser();
    const isAdminView = !!localStorage.getItem("admin_backup");
    if (!u || (!isAdminView && u.role !== "student")) {
      router.push("/");
      return;
    }
    setUser(u);
    fetchLives(u.id);
    fetch("/api/process-queue").catch(() => {});
    fetch("/api/process-reports").catch(() => {});
  }, [router]);

  const fetchLives = async (userId: string) => {
    // 담당자이거나 연결된(user_lives) 생명 모두 포함
    const { data: uls } = await supabase
      .from("user_lives")
      .select("life_id")
      .eq("user_id", userId);
    const linkedIds = (uls || []).map((u: any) => u.life_id);
    let query = supabase
      .from("lives")
      .select("id, name, stage, is_failed, updated_at, memo");
    if (linkedIds.length > 0) {
      query = query.or(`primary_user_id.eq.${userId},id.in.(${linkedIds.join(",")})`);
    } else {
      query = query.eq("primary_user_id", userId);
    }
    const { data } = await query;

    if (data) {
      const lifeList = data as Life[];

      // 최신 일지 날짜 조회
      const lifeIds = lifeList.map(l => l.id);
      if (lifeIds.length > 0) {
        const { data: journals } = await supabase
          .from("journals")
          .select("life_id, met_date")
          .in("life_id", lifeIds)
          .is("deleted_at", null)
          .order("met_date", { ascending: false });

        const lastJournal = new Map<string, string>();
        (journals || []).forEach((j: any) => {
          if (!lastJournal.has(j.life_id)) lastJournal.set(j.life_id, j.met_date);
        });

        lifeList.forEach(l => {
          if (lastJournal.has(l.id)) (l as any).last_date = lastJournal.get(l.id);
        });
      }

      setLives(lifeList);
    }
    setLoading(false);
  };

  // 연결 해제 (내 목록에서만 제거, 생명 데이터는 유지)
  const handleUnlink = async (lifeId: string) => {
    if (!user) return;
    if (!confirm("이 생명과의 연결을 해제하시겠습니까?\n(생명 데이터는 삭제되지 않습니다)")) return;

    // 담당자이기도 하면 담당자 해제
    await supabase.from("lives").update({ primary_user_id: null }).eq("id", lifeId).eq("primary_user_id", user.id);
    // user_lives 연결 제거
    await supabase.from("user_lives").delete().eq("user_id", user.id).eq("life_id", lifeId);

    setMenuLifeId(null);
    fetchLives(user.id);
  };

  // 생명 완전 삭제 (연결된 일지, 강의체크 등 모두 삭제)
  const handleDelete = async (lifeId: string, lifeName: string) => {
    if (!user) return;
    if (!confirm(`"${lifeName}" 생명을 완전히 삭제하시겠습니까?\n(모든 일지, 강의 기록이 삭제되며 복구할 수 없습니다)`)) return;

    // 연결된 데이터 삭제 (FK cascade로 일부 자동 삭제)
    await supabase.from("journals").delete().eq("life_id", lifeId);
    await supabase.from("lesson_checks").delete().eq("life_id", lifeId);
    await supabase.from("worship_attendance").delete().eq("life_id", lifeId);
    await supabase.from("bible_reading").delete().eq("life_id", lifeId);
    await supabase.from("audio_queue").delete().eq("life_id", lifeId);
    await supabase.from("user_lives").delete().eq("life_id", lifeId);
    await supabase.from("lives").delete().eq("id", lifeId);

    setMenuLifeId(null);
    fetchLives(user.id);
  };

  const handleFail = async (lifeId: string, lifeName: string) => {
    if (!user) return;
    if (!confirm(`"${lifeName}" 생명을 페일 처리하시겠습니까?`)) return;
    await supabase.from("lives").update({ is_failed: true }).eq("id", lifeId);
    setMenuLifeId(null);
    fetchLives(user.id);
  };

  // 지난 약속 중 일지 미작성 알림
  const [pastApptAlerts, setPastApptAlerts] = useState<{ apptId: string; lifeId: string; lifeName: string; date: string }[]>([]);

  useEffect(() => {
    if (!user || lives.length === 0) return;
    const fetchPastAppts = async () => {
      const lifeIds = lives.map((l) => l.id);
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().slice(0, 5);

      const { data: appts } = await supabase
        .from("appointments")
        .select("id, life_id, date, time, created_by")
        .in("life_id", lifeIds)
        .order("date", { ascending: false });

      if (!appts) return;

      // 지난 약속 필터 (날짜 지났거나, 오늘인데 시간 지남)
      const pastAppts = appts.filter((a) => {
        if (a.date < today) return true;
        if (a.date === today && a.time && a.time <= currentTime) return true;
        if (a.date === today && !a.time) return true;
        return false;
      });

      // 각 약속에 대해 해당 날짜 이후 일지가 있는지 확인
      const { data: journals } = await supabase
        .from("journals")
        .select("life_id, met_date")
        .in("life_id", lifeIds)
        .is("deleted_at", null);

      const alerts: typeof pastApptAlerts = [];
      for (const appt of pastAppts) {
        const hasJournalAfter = (journals || []).some(
          (j) => j.life_id === appt.life_id && j.met_date >= appt.date
        );
        if (!hasJournalAfter) {
          const life = lives.find((l) => l.id === appt.life_id);
          if (life && !life.is_failed) {
            // 같은 생명에 대해 이미 알림이 있으면 가장 최근 약속만
            if (!alerts.some((a) => a.lifeId === appt.life_id)) {
              alerts.push({ apptId: appt.id, lifeId: appt.life_id, lifeName: life.name, date: appt.date });
            }
          }
        }
      }
      setPastApptAlerts(alerts);
    };
    fetchPastAppts();
  }, [user, lives]);

  const dismissApptAlert = async (apptId: string) => {
    await supabase.from("appointments").delete().eq("id", apptId);
    setPastApptAlerts((prev) => prev.filter((a) => a.apptId !== apptId));
  };

  const activeLives = lives.filter((l) => !l.is_failed);
  const failedLives = lives.filter((l) => l.is_failed);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <AdminViewBanner />
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold cursor-pointer" onClick={() => window.location.reload()}>CNUcare</h1>
          <p className="text-xs text-gray-500">{user?.display_name}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          로그아웃
        </button>
      </header>

      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <button onClick={() => setTab("lives")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${tab === "lives" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
          내 생명
        </button>
        <button onClick={() => setTab("calendar")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${tab === "calendar" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
          캘린더
        </button>
        <button onClick={() => setTab("events")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${tab === "events" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"}`}>
          행사
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
      {tab === "events" && (
        <div className="p-4">
          <EventList basePath="/student" />
        </div>
      )}

      {tab === "calendar" && (
        <div className="p-4">
          <InstructorCalendar basePath="/student" />
        </div>
      )}

      {tab === "lives" && (
      <div className="p-4 space-y-3">
        {/* 지난 약속 알림 */}
        {pastApptAlerts.map((alert) => (
          <div key={alert.apptId} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800 font-medium">
              {new Date(alert.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} {alert.lifeName}과 잘 만나셨나요?
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => router.push(`/student/life/${alert.lifeId}/journal/new`)}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                일지 쓰기
              </button>
              <button
                onClick={() => dismissApptAlert(alert.apptId)}
                className="flex-1 bg-white text-gray-500 border border-gray-300 rounded-lg py-2 text-sm"
              >
                만나지 못했어요
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={() => router.push("/student/life/new")}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 py-4 text-center text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          + 생명 추가
        </button>

        {activeLives.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            등록된 생명이 없습니다.
          </p>
        )}

        {activeLives.map((life) => (
          <div key={life.id} className="relative">
            <div className="flex bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
              <button
                onClick={() => router.push(`/student/life/${life.id}`)}
                className="flex-1 p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-base shrink-0">{life.name}</span>
                    {life.memo && (
                      <span className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 truncate" title={life.memo}>
                        {life.memo}
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                      STAGE_COLORS[life.stage] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {STAGE_LABELS[life.stage] || life.stage}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date((life as any).last_date || life.updated_at).toLocaleDateString("ko-KR")}
                </p>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuLifeId(menuLifeId === life.id ? null : life.id); }}
                className="px-3 flex items-center text-gray-300 hover:text-gray-500"
              >
                ⋯
              </button>
            </div>

            {/* 메뉴 */}
            {menuLifeId === life.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuLifeId(null)} />
                <div className="absolute right-2 top-12 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44">
                  <button
                    onClick={() => handleUnlink(life.id)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    연결 해제
                    <p className="text-[10px] text-gray-400">내 목록에서만 제거</p>
                  </button>
                  <button
                    onClick={() => handleDelete(life.id, life.name)}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                  >
                    완전 삭제
                    <p className="text-[10px] text-red-300">모든 데이터 영구 삭제</p>
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {failedLives.length > 0 && (
          <details className="mt-6">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500">
              페일 목록 ({failedLives.length})
            </summary>
            <div className="mt-2 space-y-2">
              {failedLives.map((life) => (
                <div key={life.id} className="relative">
                  <div className="flex bg-gray-100 rounded-lg border border-gray-200 opacity-60">
                    <button
                      onClick={() => router.push(`/student/life/${life.id}`)}
                      className="flex-1 p-3 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">{life.name}</span>
                        <span className="text-xs text-red-400">페일</span>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuLifeId(menuLifeId === life.id ? null : life.id); }}
                      className="px-3 flex items-center text-gray-300 hover:text-gray-500"
                    >
                      ⋯
                    </button>
                  </div>

                  {menuLifeId === life.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuLifeId(null)} />
                      <div className="absolute right-2 top-10 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44">
                        <button
                          onClick={() => handleUnlink(life.id)}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          연결 해제
                          <p className="text-[10px] text-gray-400">내 목록에서만 제거</p>
                        </button>
                        <button
                          onClick={() => handleDelete(life.id, life.name)}
                          className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                        >
                          완전 삭제
                          <p className="text-[10px] text-red-300">모든 데이터 영구 삭제</p>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
      )}
      </div>
    </div>
  );
}
