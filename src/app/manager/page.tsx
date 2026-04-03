"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, User } from "@/lib/auth";
import OrgChart from "@/components/OrgChart";
import Dashboard from "@/components/Dashboard";
import AnalysisPage from "@/components/AnalysisPage";
import MyLives from "@/components/MyLives";

export default function ManagerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState<"org" | "mylives" | "dashboard" | "analysis">("org");

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "manager") {
      router.push("/");
      return;
    }
    setUser(u);
    fetch("/api/process-queue").catch(() => {});
    fetch("/api/process-reports").catch(() => {});
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">CNUcare</h1>
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

      <div className="p-4">
        {tab === "org" && <OrgChart userRole="manager" userId={user.id} basePath="/manager" editMode={editMode} />}
        {tab === "mylives" && <MyLives userId={user.id} basePath="/manager" />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "analysis" && <AnalysisPage />}
      </div>
    </div>
  );
}
