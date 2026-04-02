"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, User } from "@/lib/auth";
import OrgChart from "@/components/OrgChart";

export default function ManagerPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "manager") {
      router.push("/");
      return;
    }
    setUser(u);
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">조직도</h1>
          <p className="text-xs text-gray-500">{user.display_name} (관리자)</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          로그아웃
        </button>
      </header>

      <div className="p-4">
        <OrgChart userRole="manager" userId={user.id} basePath="/manager" />
      </div>
    </div>
  );
}
