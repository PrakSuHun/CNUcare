"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, User } from "@/lib/auth";
import OrgChart from "@/components/OrgChart";
import Dashboard from "@/components/Dashboard";
import AnalysisPage from "@/components/AnalysisPage";

export default function InstructorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState<"org" | "dashboard" | "analysis">("org");

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "instructor") {
      router.push("/");
      return;
    }
    setUser(u);
    fetch("/api/process-queue").catch(() => {});
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">CNUcare</h1>
          <p className="text-xs text-gray-500">{user.display_name} (강사)</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "org" && (
            <button
              onClick={() => setEditMode(!editMode)}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                editMode
                  ? "bg-orange-500 text-white border-orange-500"
                  : "text-gray-500 border-gray-300 hover:border-orange-400"
              }`}
            >
              {editMode ? "편집 완료" : "편집"}
            </button>
          )}
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">
            로그아웃
          </button>
        </div>
      </header>

      <div className="flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setTab("org")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            tab === "org" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          조직도
        </button>
        <button
          onClick={() => setTab("dashboard")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            tab === "dashboard" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          현황
        </button>
        <button
          onClick={() => setTab("analysis")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            tab === "analysis" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          AI 분석
        </button>
      </div>

      <div className="p-4">
        {tab === "org" && (
          <OrgChart userRole="instructor" userId={user.id} basePath="/instructor" editMode={editMode} />
        )}
        {tab === "dashboard" && <Dashboard />}
        {tab === "analysis" && <AnalysisPage />}
      </div>
    </div>
  );
}
