"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, logout, User } from "@/lib/auth";
import { STAGE_LABELS, STAGE_COLORS } from "@/lib/stages";

interface Life {
  id: string;
  name: string;
  stage: string;
  is_failed: boolean;
  updated_at: string;
}

export default function StudentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lives, setLives] = useState<Life[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuLifeId, setMenuLifeId] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== "student") {
      router.push("/");
      return;
    }
    setUser(u);
    fetchLives(u.id);
    fetch("/api/process-queue").catch(() => {});
    fetch("/api/process-reports").catch(() => {});
  }, [router]);

  const fetchLives = async (userId: string) => {
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

  // 연결 해제 (내 목록에서만 제거, 생명 데이터는 유지)
  const handleUnlink = async (lifeId: string) => {
    if (!user) return;
    if (!confirm("이 생명과의 연결을 해제하시겠습니까?\n(생명 데이터는 삭제되지 않습니다)")) return;

    await supabase
      .from("user_lives")
      .delete()
      .eq("user_id", user.id)
      .eq("life_id", lifeId);

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
    </div>
  );
}
