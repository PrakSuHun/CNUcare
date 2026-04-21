"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STAGE_LABELS, STAGE_COLORS } from "@/lib/stages";

interface Life {
  id: string;
  name: string;
  stage: string;
  is_failed: boolean;
  updated_at: string;
  memo: string | null;
}

interface MyLivesProps {
  userId: string;
  basePath: string;
}

export default function MyLives({ userId, basePath }: MyLivesProps) {
  const router = useRouter();
  const [lives, setLives] = useState<Life[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuLifeId, setMenuLifeId] = useState<string | null>(null);

  useEffect(() => {
    fetchLives();
  }, [userId]);

  const fetchLives = async () => {
    // 담당자이거나 연결된(user_lives) 생명 모두 포함
    const { data: uls } = await supabase
      .from("user_lives")
      .select("life_id")
      .eq("user_id", userId);
    const linkedIds = (uls || []).map((u: any) => u.life_id);
    let query = supabase
      .from("lives")
      .select("id, name, stage, is_failed, updated_at, memo");
    if (linkedIds.length > 0) {
      query = query.or(`primary_user_id.eq.${userId},id.in.(${linkedIds.join(",")})`);
    } else {
      query = query.eq("primary_user_id", userId);
    }
    const { data } = await query;
    if (data) setLives(data as Life[]);
    setLoading(false);
  };

  const handleFail = async (lifeId: string, lifeName: string) => {
    if (!confirm(`"${lifeName}" 생명을 페일 처리하시겠습니까?`)) return;
    await supabase.from("lives").update({ is_failed: true }).eq("id", lifeId);
    setMenuLifeId(null);
    fetchLives();
  };

  const handleUnlink = async (lifeId: string) => {
    if (!confirm("이 생명과의 연결을 해제하시겠습니까?")) return;
    await supabase.from("lives").update({ primary_user_id: null }).eq("id", lifeId).eq("primary_user_id", userId);
    await supabase.from("user_lives").delete().eq("user_id", userId).eq("life_id", lifeId);
    setMenuLifeId(null);
    fetchLives();
  };

  const handleDelete = async (lifeId: string, lifeName: string) => {
    if (!confirm(`"${lifeName}" 생명을 완전히 삭제하시겠습니까?\n(복구 불가)`)) return;
    await supabase.from("journals").delete().eq("life_id", lifeId);
    await supabase.from("lesson_checks").delete().eq("life_id", lifeId);
    await supabase.from("worship_attendance").delete().eq("life_id", lifeId);
    await supabase.from("bible_reading").delete().eq("life_id", lifeId);
    await supabase.from("audio_queue").delete().eq("life_id", lifeId);
    await supabase.from("user_lives").delete().eq("life_id", lifeId);
    await supabase.from("lives").delete().eq("id", lifeId);
    setMenuLifeId(null);
    fetchLives();
  };

  const activeLives = lives.filter((l) => !l.is_failed);
  const failedLives = lives.filter((l) => l.is_failed);

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>;
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => router.push(`${basePath}/life/new`)}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 py-4 text-center text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        + 생명 추가
      </button>

      {activeLives.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-4">내가 관리하는 생명이 없습니다.</p>
      )}

      {activeLives.map((life) => (
        <div key={life.id} className="relative">
          <div className="flex bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
            <button
              onClick={() => router.push(`${basePath}/life/${life.id}`)}
              className="flex-1 p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-base shrink-0">{life.name}</span>
                  {life.memo && (
                    <span className="text-[11px] text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5 truncate" title={life.memo}>
                      {life.memo}
                    </span>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${STAGE_COLORS[life.stage] || "bg-gray-100 text-gray-700"}`}>
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
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer">페일 ({failedLives.length})</summary>
          <div className="mt-2 space-y-2">
            {failedLives.map((life) => (
              <button
                key={life.id}
                onClick={() => router.push(`${basePath}/life/${life.id}`)}
                className="w-full bg-gray-100 rounded-lg border border-gray-200 p-3 text-left opacity-60"
              >
                <span className="text-sm text-gray-500">{life.name}</span>
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
