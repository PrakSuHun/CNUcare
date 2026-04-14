"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, User } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import OrgChart from "@/components/OrgChart";
import Dashboard from "@/components/Dashboard";
import AnalysisPage from "@/components/AnalysisPage";
import InstructorCalendar from "@/components/InstructorCalendar";
import MyLives from "@/components/MyLives";
import AdminViewBanner from "@/components/AdminViewBanner";
import EventList from "@/components/EventList";

export default function ManagerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState<"org" | "mylives" | "calendar" | "dashboard" | "analysis" | "events">("org");

  useEffect(() => {
    const u = getUser();
    const isAdminView = !!localStorage.getItem("admin_backup");
    const allowed = u && (u.role === "manager" || (u.role === "student" && u.is_college_leader));
    if (!u || (!isAdminView && !allowed)) {
      router.push("/");
      return;
    }
    setUser(u);
    fetch("/api/process-queue").catch(() => {});
    fetch("/api/process-reports").catch(() => {});
  }, [router]);

  // 지난 약속 알림
  const [pastApptAlerts, setPastApptAlerts] = useState<{ apptId: string; lifeId: string; lifeName: string; date: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchAlerts = async () => {
      // 관리자가 연결된 생명 조회
      const { data: uls } = await supabase.from("user_lives").select("life_id, lives(id, name, is_failed)").eq("user_id", user.id);
      if (!uls) return;
      const lifeIds = uls.map((ul: any) => ul.life_id);
      const lifeMap = new Map(uls.map((ul: any) => [ul.life_id, ul.lives]));
      if (lifeIds.length === 0) return;

      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().slice(0, 5);

      const { data: appts } = await supabase.from("appointments").select("id, life_id, date, time")
        .in("life_id", lifeIds).order("date", { ascending: false });
      if (!appts) return;

      const pastAppts = appts.filter((a: any) => {
        if (a.date < today) return true;
        if (a.date === today && a.time && a.time <= currentTime) return true;
        if (a.date === today && !a.time) return true;
        return false;
      });

      const { data: journals } = await supabase.from("journals").select("life_id, met_date")
        .in("life_id", lifeIds).is("deleted_at", null);

      const alerts: typeof pastApptAlerts = [];
      for (const appt of pastAppts) {
        const hasJournal = (journals || []).some((j: any) => j.life_id === appt.life_id && j.met_date >= appt.date);
        if (!hasJournal) {
          const life = lifeMap.get(appt.life_id) as any;
          if (life && !life.is_failed && !alerts.some(a => a.lifeId === appt.life_id)) {
            alerts.push({ apptId: appt.id, lifeId: appt.life_id, lifeName: life.name, date: appt.date });
          }
        }
      }
      setPastApptAlerts(alerts);
    };
    fetchAlerts();
  }, [user]);

  const dismissApptAlert = async (apptId: string) => {
    await supabase.from("appointments").delete().eq("id", apptId);
    setPastApptAlerts((prev) => prev.filter((a) => a.apptId !== apptId));
  };

  if (!user) return null;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <AdminViewBanner />
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold cursor-pointer" onClick={() => window.location.reload()}>CNUcare</h1>
          <p className="text-xs text-gray-500">{user.display_name} (관리자)</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "org" && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                editMode ? "bg-orange-500 text-white border-orange-500" : "text-gray-500 border-gray-300 hover:border-orange-400"
              }`}
            >
              {editMode ? "편집 완료" : "편집"}
            </button>
          )}
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">로그아웃</button>
        </div>
      </header>

      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {[
          { key: "org", label: "조직도" },
          { key: "mylives", label: "내 생명" },
          { key: "calendar", label: "캘린더" },
          { key: "events", label: "행사" },
          { key: "dashboard", label: "현황" },
          { key: "analysis", label: "AI 분석" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors whitespace-nowrap px-2 ${
              tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* 약속 알림 */}
        {pastApptAlerts.map((alert) => (
          <div key={alert.apptId} className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
            <p className="text-sm text-blue-800 font-medium">
              {new Date(alert.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })} {alert.lifeName}과 잘 만나셨나요?
            </p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => router.push(`/manager/life/${alert.lifeId}/journal/new`)}
                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">일지 쓰기</button>
              <button onClick={() => dismissApptAlert(alert.apptId)}
                className="flex-1 bg-white text-gray-500 border border-gray-300 rounded-lg py-2 text-sm">만나지 못했어요</button>
            </div>
          </div>
        ))}
        {tab === "org" && <OrgChart userRole="manager" userId={user.id} basePath="/manager" editMode={editMode} />}
        {tab === "mylives" && <MyLives userId={user.id} basePath="/manager" />}
        {tab === "calendar" && <InstructorCalendar basePath="/manager" />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "analysis" && <AnalysisPage />}
        {tab === "events" && <EventList basePath="/manager" />}
      </div>
    </div>
  );
}
