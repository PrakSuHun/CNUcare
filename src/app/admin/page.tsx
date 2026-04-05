"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, logout, User } from "@/lib/auth";
import OrgChart from "@/components/OrgChart";
import Dashboard from "@/components/Dashboard";
import AnalysisPage from "@/components/AnalysisPage";
import InstructorCalendar from "@/components/InstructorCalendar";

interface UserRow {
  id: string;
  login_id: string;
  display_name: string;
  name: string;
  role: string;
  phone: string;
  birth_date: string | null;
  manager_id: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  student: "bg-gray-100 text-gray-700",
  manager: "bg-yellow-100 text-yellow-700",
  instructor: "bg-blue-100 text-blue-700",
  leader: "bg-purple-100 text-purple-700",
  admin: "bg-red-100 text-red-700",
};

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"org" | "calendar" | "dashboard" | "analysis" | "users">("org");
  const [editMode, setEditMode] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ display_name: "", name: "", phone: "", birth_date: "", password: "", manager_id: "" });

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
      .select("id, login_id, display_name, name, role, phone, birth_date, manager_id")
      .order("role")
      .order("display_name");
    if (data) setUsers(data);
    setLoading(false);
  };

  const changeRole = async (userId: string, newRole: string) => {
    await supabase.from("users").update({ role: newRole }).eq("id", userId);
    fetchUsers();
  };

  const openEdit = (u: UserRow) => {
    setEditingUser(u);
    setEditForm({
      display_name: u.display_name || "",
      name: u.name || "",
      phone: u.phone || "",
      birth_date: u.birth_date || "",
      password: "",
      manager_id: u.manager_id || "",
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    const updates: Record<string, string> = {
      display_name: editForm.display_name,
      name: editForm.name,
      phone: editForm.phone,
      birth_date: editForm.birth_date,
    };
    if (editForm.password) updates.password = editForm.password;
    if (editForm.manager_id) updates.manager_id = editForm.manager_id;
    else updates.manager_id = "";
    await supabase.from("users").update(updates).eq("id", editingUser.id);
    setEditingUser(null);
    fetchUsers();
  };

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`"${u.display_name}" 계정을 삭제하시겠습니까?\n연결된 생명·일지는 유지됩니다.`)) return;
    await supabase.from("user_lives").delete().eq("user_id", u.id);
    await supabase.from("users").delete().eq("id", u.id);
    fetchUsers();
  };

  const managers = users.filter((u) => u.role === "manager");

  if (!user || loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
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
          { key: "calendar", label: "캘린더" },
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

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "org" && (
          <OrgChart userRole="instructor" userId={user.id} basePath="/admin" editMode={editMode} />
        )}
        {tab === "calendar" && <InstructorCalendar basePath="/admin" />}
        {tab === "dashboard" && <Dashboard />}
        {tab === "analysis" && <AnalysisPage />}
        {tab === "users" && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">전체 {users.length}명</p>
            {users.map((u) => (
              <div key={u.id} className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => openEdit(u)} className="text-left flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.display_name}</p>
                    <p className="text-xs text-gray-400">@{u.login_id} · {u.phone || "전화없음"}</p>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className={`text-xs rounded-full px-2.5 py-1 border-0 font-medium ${ROLE_COLORS[u.role] || "bg-gray-100"}`}
                    >
                      <option value="student">대학생</option>
                      <option value="manager">관리자</option>
                      <option value="instructor">강사</option>
                      <option value="leader">지도자</option>
                      <option value="admin">어드민</option>
                    </select>
                    <button onClick={() => deleteUser(u)} className="text-gray-300 hover:text-red-400 text-sm px-1">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 사용자 정보 수정 모달 */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setEditingUser(null)}>
            <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold">사용자 정보 수정</h3>
                <button onClick={() => setEditingUser(null)} className="text-xs text-gray-400">닫기</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">표시 이름</label>
                  <input value={editForm.display_name} onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">이름</label>
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">전화번호</label>
                  <input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">생년월일</label>
                  <input type="date" value={editForm.birth_date} onChange={(e) => setEditForm((f) => ({ ...f, birth_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">비밀번호 변경 (4자리, 비워두면 유지)</label>
                  <input type="text" maxLength={4} value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="변경 시 입력" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1" />
                </div>
                {editingUser.role === "student" && (
                  <div>
                    <label className="text-xs text-gray-500">소속 관리자</label>
                    <select value={editForm.manager_id} onChange={(e) => setEditForm((f) => ({ ...f, manager_id: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-1">
                      <option value="">없음</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>{m.display_name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={saveEdit} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium">저장</button>
                  <button onClick={() => setEditingUser(null)} className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-2.5 text-sm">취소</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
