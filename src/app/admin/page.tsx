"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, logout, User } from "@/lib/auth";

interface UserRow {
  id: string;
  login_id: string;
  display_name: string;
  role: string;
  phone: string;
}

const ROLE_LABELS: Record<string, string> = {
  student: "대학생",
  manager: "관리자",
  instructor: "강사",
  admin: "어드민",
};

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

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "admin") {
      router.push("/");
      return;
    }
    setUser(u);
    fetchUsers();
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
          <h1 className="text-lg font-bold">어드민</h1>
          <p className="text-xs text-gray-500">사용자 역할 관리</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">
          로그아웃
        </button>
      </header>

      <div className="p-4 space-y-2">
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
    </div>
  );
}
