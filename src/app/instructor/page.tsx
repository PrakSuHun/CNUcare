"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, logout, User } from "@/lib/auth";
import OrgChart from "@/components/OrgChart";

export default function InstructorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "instructor") {
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
          <p className="text-xs text-gray-500">{user.display_name} (강사)</p>
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            로그아웃
          </button>
        </div>
      </header>

      <div className="p-4">
        <OrgChart userRole="instructor" userId={user.id} basePath="/instructor" editMode={editMode} />
      </div>
    </div>
  );
}
