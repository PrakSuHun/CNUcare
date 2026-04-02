"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, logout, User } from "@/lib/auth";

interface Life {
  id: string;
  name: string;
  stage: string;
  is_failed: boolean;
  updated_at: string;
}

const STAGE_LABELS: Record<string, string> = {
  first_meeting: "1차 만남",
  pre_visit: "전초",
  intro: "입문",
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
  completed: "수료",
};

const STAGE_COLORS: Record<string, string> = {
  first_meeting: "bg-red-100 text-red-700",
  pre_visit: "bg-orange-100 text-orange-700",
  intro: "bg-amber-100 text-amber-700",
  beginner: "bg-yellow-100 text-yellow-700",
  intermediate: "bg-blue-100 text-blue-700",
  advanced: "bg-teal-100 text-teal-700",
  completed: "bg-green-100 text-green-700",
};

export default function StudentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lives, setLives] = useState<Life[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "student") {
      router.push("/");
      return;
    }
    setUser(u);
    fetchLives(u.id);
  }, [router]);

  const fetchLives = async (userId: string) => {
    // user_lives를 통해 연결된 생명 조회
    const { data } = await supabase
      .from("user_lives")
      .select("life_id, lives(id, name, stage, is_failed, updated_at)")
      .eq("user_id", userId);

    if (data) {
      const lifeList = data
        .map((ul: any) => ul.lives as Life)
        .filter(Boolean);
      setLives(lifeList);
    }
    setLoading(false);
  };

  const activeLives = lives.filter((l) => !l.is_failed);
  const failedLives = lives.filter((l) => l.is_failed);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">내 생명 목록</h1>
          <p className="text-xs text-gray-500">{user?.display_name}</p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          로그아웃
        </button>
      </header>

      <div className="p-4 space-y-3">
        {/* 생명 추가 버튼 */}
        <button
          onClick={() => router.push("/student/life/new")}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 py-4 text-center text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          + 생명 추가
        </button>

        {/* 활성 생명 목록 */}
        {activeLives.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">
            등록된 생명이 없습니다.
          </p>
        )}

        {activeLives.map((life) => (
          <button
            key={life.id}
            onClick={() => router.push(`/student/life/${life.id}`)}
            className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-base">{life.name}</span>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  STAGE_COLORS[life.stage] || "bg-gray-100 text-gray-700"
                }`}
              >
                {STAGE_LABELS[life.stage] || life.stage}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {new Date(life.updated_at).toLocaleDateString("ko-KR")}
            </p>
          </button>
        ))}

        {/* 페일 목록 */}
        {failedLives.length > 0 && (
          <details className="mt-6">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500">
              페일 목록 ({failedLives.length})
            </summary>
            <div className="mt-2 space-y-2">
              {failedLives.map((life) => (
                <button
                  key={life.id}
                  onClick={() => router.push(`/student/life/${life.id}`)}
                  className="w-full bg-gray-100 rounded-lg border border-gray-200 p-3 text-left opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{life.name}</span>
                    <span className="text-xs text-red-400">페일</span>
                  </div>
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
