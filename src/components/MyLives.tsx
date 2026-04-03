"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Life {
  id: string;
  name: string;
  stage: string;
  is_failed: boolean;
  updated_at: string;
}

import { STAGE_LABELS, STAGE_COLORS } from "@/lib/stages";

interface MyLivesProps {
  userId: string;
  basePath: string;
}

export default function MyLives({ userId, basePath }: MyLivesProps) {
  const router = useRouter();
  const [lives, setLives] = useState<Life[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLives();
  }, [userId]);

  const fetchLives = async () => {
    const { data } = await supabase
      .from("user_lives")
      .select("life_id, lives(id, name, stage, is_failed, updated_at)")
      .eq("user_id", userId);

    if (data) {
      setLives(data.map((ul: any) => ul.lives as Life).filter(Boolean));
    }
    setLoading(false);
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
        <button
          key={life.id}
          onClick={() => router.push(`${basePath}/life/${life.id}`)}
          className="w-full bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-base">{life.name}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STAGE_COLORS[life.stage] || "bg-gray-100 text-gray-700"}`}>
              {STAGE_LABELS[life.stage] || life.stage}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(life.updated_at).toLocaleDateString("ko-KR")}
          </p>
        </button>
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
