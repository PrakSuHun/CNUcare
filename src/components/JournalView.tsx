"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface JournalViewProps {
  lifeId: string;
  journalId: string;
  backPath: string;
}

export default function JournalView({ lifeId, journalId, backPath }: JournalViewProps) {
  const router = useRouter();
  const [journal, setJournal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJournal();
  }, [journalId]);

  const fetchJournal = async () => {
    const { data } = await supabase
      .from("journals")
      .select("*, author:users(display_name)")
      .eq("id", journalId)
      .single();
    if (data) setJournal(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  if (!journal) {
    return <div className="flex min-h-full items-center justify-center"><p className="text-gray-500">일지를 찾을 수 없습니다.</p></div>;
  }

  const purposeLabels: Record<string, string> = {
    first_meeting: "1차 만남",
    pre_visit: "전초",
    management: "관리",
    lecture: "강의",
  };

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => router.push(backPath)} className="text-gray-500 mr-3">&larr;</button>
        <h1 className="text-lg font-bold">일지 상세</h1>
      </header>

      <div className="p-4 space-y-4">
        {/* 목적 */}
        {journal.purpose && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">목적</p>
            <p className="text-sm font-medium">{purposeLabels[journal.purpose] || journal.purpose}</p>
          </div>
        )}

        {/* 강의자 */}
        {journal.instructor_name && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-1">강의자</p>
            <p className="text-sm font-medium">{journal.instructor_name}</p>
          </div>
        )}

        {/* 날짜 & 장소 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">날짜</p>
            <p className="text-sm">{new Date(journal.met_date).toLocaleDateString("ko-KR")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">장소</p>
            <p className="text-sm">{journal.location || "-"}</p>
          </div>
        </div>

        {/* 작성자 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">작성자</p>
          <p className="text-sm">{journal.author?.display_name || "-"}</p>
        </div>

        {/* 생명 반응 */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-400 mb-1">생명 반응</p>
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{journal.response || "-"}</p>
        </div>

        {/* 녹음 */}
        {journal.audio_url && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-xs text-gray-400 mb-2">녹음</p>
            <audio src={journal.audio_url} controls className="w-full h-8" />
          </div>
        )}
      </div>
    </div>
  );
}
