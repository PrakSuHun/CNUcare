"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, logout, User } from "@/lib/auth";
import OrgChart from "@/components/OrgChart";
import Dashboard from "@/components/Dashboard";
import AnalysisPage from "@/components/AnalysisPage";

interface UserRow {
  id: string;
  login_id: string;
  display_name: string;
  role: string;
  phone: string;
}

const ROLE_COLORS: Record<string, string> = {
  student: "bg-gray-100 text-gray-700",
  manager: "bg-yellow-100 text-yellow-700",
  instructor: "bg-blue-100 text-blue-700",
  admin: "bg-red-100 text-red-700",
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"org" | "dashboard" | "analysis" | "users">("org");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "admin") {
      router.push("/");
      return;
    }
    setUser(u);
    fetchUsers();
    fetch("/api/process-queue").catch(() => {});
    fetch("/api/process-reports").catch(() => {});
  }, [router]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("users")
      .select("id, login_id, display_name, role, phone")
      .order("role")
      .order("display_name");
    if (data) setUsers(data);
    setLoading(false);
  };

  const changeRole = async (userId: string, newRole: string) => {
    await supabase.from("users").update({ role: newRole }).eq("id", userId);
    fetchUsers();
  };

  if (!user || loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">CNUcare</h1>
          <p className="text-xs text-gray-500">{user.display_name} (어드민)</p>
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

      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {[
          { key: "org", label: "조직도" },
          { key: "dashboard", label: "현황" },
          { key: "analysis", label: "AI 분석" },
          { key: "users", label: "권한 관리" },
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
        {tab === "org" && (
          <OrgChart userRole="instructor" userId={user.id} basePath="/admin" editMode={editMode} />
        )}
        {tab === "dashboard" && <Dashboard />}
        {tab === "analysis" && <AnalysisPage />}
        {tab === "users" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">전체 {users.length}명</p>
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{u.display_name}</p>
                  <p className="text-xs text-gray-400">@{u.login_id}</p>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                  className={`text-xs rounded-full px-3 py-1.5 border-0 font-medium ${
                    ROLE_COLORS[u.role] || "bg-gray-100"
                  }`}
                >
                  <option value="student">대학생</option>
                  <option value="manager">관리자</option>
                  <option value="instructor">강사</option>
                  <option value="admin">어드민</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
