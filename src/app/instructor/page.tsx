"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, logout, User } from "@/lib/auth";
import { STAGE_LABELS, STAGE_COLORS, STAGE_NAME_COLORS } from "@/lib/stages";
import InstructorAnalysis from "@/components/InstructorAnalysis";
import InstructorCalendar from "@/components/InstructorCalendar";
import AdminViewBanner from "@/components/AdminViewBanner";

interface Life {
  id: string;
  name: string;
  stage: string;
  is_failed: boolean;
  updated_at: string;
  department: string | null;
  age: number | null;
}

interface SimilarLife {
  id: string;
  name: string;
  age: number | null;
  department: string | null;
}

export default function InstructorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [lives, setLives] = useState<Life[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lives" | "calendar" | "analysis">("lives");
  const [showAdd, setShowAdd] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<SimilarLife[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const u = getUser();
    const isAdminView = !!localStorage.getItem("admin_backup");
    if (!u || (!isAdminView && u.role !== "instructor")) {
      router.push("/");
      return;
    }
    setUser(u);
    fetchLives(u.id);
    fetch("/api/process-queue").catch(() => {});
  }, [router]);

  const fetchLives = async (userId: string) => {
    const { data } = await supabase
      .from("user_lives")
      .select("life_id, lives(id, name, stage, is_failed, updated_at, department, age)")
      .eq("user_id", userId);

    if (data) {
      setLives(data.map((ul: any) => ul.lives as Life).filter(Boolean));
    }
    setLoading(false);
  };

  const handleUnlink = async (lifeId: string) => {
    if (!user) return;
    if (!confirm("이 생명과의 연결을 해제하시겠습니까?")) return;
    await supabase.from("user_lives").delete().eq("user_id", user.id).eq("life_id", lifeId);
    fetchLives(user.id);
  };

  const handleSearch = async () => {
    if (!searchName.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("lives")
      .select("id, name, age, department")
      .ilike("name", `%${searchName.trim()}%`)
      .limit(20);
    setSearchResults(data || []);
    setSearching(false);
  };

  const handleLink = async (lifeId: string) => {
    if (!user) return;
    await supabase.from("user_lives").upsert({
      user_id: user.id,
      life_id: lifeId,
      role_in_life: "instructor",
    }, { onConflict: "user_id,life_id" });
    setShowAdd(false);
    setSearchName("");
    setSearchResults([]);
    fetchLives(user.id);
  };

  const activeLives = lives.filter((l) => !l.is_failed);
  const failedLives = lives.filter((l) => l.is_failed);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <AdminViewBanner />
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold">CNUcare</h1>
          <p className="text-xs text-gray-500">{user?.display_name} (강사)</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">로그아웃</button>
      </header>

      <div className="flex border-b border-gray-200 bg-white overflow-x-auto shrink-0">
        {[
          { key: "lives", label: "내 강의 생명" },
          { key: "calendar", label: "캘린더" },
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

      <div className="flex-1 overflow-y-auto">
      {tab === "calendar" && (
        <div className="p-4">
          <InstructorCalendar basePath="/instructor" />
        </div>
      )}

      {tab === "analysis" && (
        <div className="p-4">
          <InstructorAnalysis />
        </div>
      )}

      {tab === "lives" && (
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">내 강의 생명 ({activeLives.length})</p>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs text-blue-500 border border-blue-300 rounded-full px-3 py-1"
          >
            {showAdd ? "취소" : "+ 생명 연결"}
          </button>
        </div>

        {/* 생명 검색/연결 */}
        {showAdd && (
          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="생명 이름 검색"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                검색
              </button>
            </div>
            {searchResults.map((life) => (
              <button
                key={life.id}
                onClick={() => handleLink(life.id)}
                className="w-full text-left bg-gray-50 rounded-lg border border-gray-200 p-3 hover:border-blue-300"
              >
                <span className="text-sm font-medium">{life.name}</span>
                {life.age && <span className="text-xs text-gray-400 ml-2">{life.age}세</span>}
                {life.department && <span className="text-xs text-gray-400 ml-2">{life.department}</span>}
              </button>
            ))}
            {searchResults.length === 0 && searchName && !searching && (
              <p className="text-xs text-gray-400 text-center py-2">검색 결과가 없습니다</p>
            )}
          </div>
        )}

        {/* 활성 생명 목록 */}
        {activeLives.length === 0 && !showAdd && (
          <p className="text-center text-sm text-gray-400 py-8">
            연결된 생명이 없습니다.<br />
            <span className="text-xs">대학생/관리자가 일지에 강의자 이름을 입력하면 자동 연결됩니다.</span>
          </p>
        )}

        {activeLives.map((life) => (
          <div key={life.id} className="bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
            <div className="flex items-center">
              <button
                onClick={() => router.push(`/instructor/life/${life.id}`)}
                className="flex-1 p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-base ${STAGE_NAME_COLORS[life.stage] || "text-gray-800"}`}>
                      {life.name}
                    </span>
                    {life.age && <span className="text-xs text-gray-400">{life.age}세</span>}
                    {life.department && <span className="text-xs text-gray-400">{life.department}</span>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGE_COLORS[life.stage] || "bg-gray-100"}`}>
                    {STAGE_LABELS[life.stage] || life.stage}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(life.updated_at).toLocaleDateString("ko-KR")}
                </p>
              </button>
              <button
                onClick={() => handleUnlink(life.id)}
                className="px-3 text-xs text-gray-300 hover:text-red-400"
              >
                해제
              </button>
            </div>
          </div>
        ))}

        {/* 페일 목록 */}
        {failedLives.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-gray-400 cursor-pointer">페일 ({failedLives.length})</summary>
            <div className="mt-2 space-y-2">
              {failedLives.map((life) => (
                <button
                  key={life.id}
                  onClick={() => router.push(`/instructor/life/${life.id}`)}
                  className="w-full bg-gray-100 rounded-lg border border-gray-200 p-3 text-left opacity-60"
                >
                  <span className="text-sm text-gray-500">{life.name}</span>
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
      )}
      </div>
    </div>
  );
}
