"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

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
    return <div className="flex h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  if (!journal) {
    return <div className="flex h-full items-center justify-center"><p className="text-gray-500">일지를 찾을 수 없습니다.</p></div>;
  }

  const purposeLabels: Record<string, string> = {
    first_meeting: "1차 만남",
    pre_visit: "전초",
    management: "관리",
    lecture: "강의",
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center shrink-0">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push(backPath); }} className="text-gray-500 mr-3">&larr;</button>
        <h1 className="text-lg font-bold">일지 상세</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

        {/* 재녹음 */}
        <ReRecordButton journalId={journalId} lifeId={lifeId} onDone={fetchJournal} />
      </div>
    </div>
  );
}

function ReRecordButton({ journalId, lifeId, onDone }: { journalId: string; lifeId: string; onDone: () => void }) {
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      alert("마이크 접근이 거부되었습니다.");
    }
  };

  const stopAndSave = async () => {
    if (!mediaRef.current) return;
    setSaving(true);

    const recorder = mediaRef.current;
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      recorder.stop();
    });
    recorder.stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);

    // 1. Storage에 업로드
    const fileName = `rerecord_${journalId}_${Date.now()}.webm`;
    const { data: uploaded } = await supabase.storage.from("recordings").upload(fileName, blob);
    if (!uploaded) { alert("녹음 저장 실패"); setSaving(false); return; }

    const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(fileName);
    const audioUrl = urlData.publicUrl;

    // 2. 일지를 변환 중으로 업데이트
    await supabase.from("journals").update({
      response: "(텍스트 변환 중입니다)",
      audio_url: audioUrl,
    }).eq("id", journalId);

    // 3. 변환 큐에 등록
    const user = getUser();
    await supabase.from("audio_queue").insert({
      life_id: lifeId,
      audio_url: audioUrl,
      requester_id: user?.id || null,
      status: "pending",
    });

    // 4. 변환 요청
    fetch("/api/process-queue").catch(() => {});

    setSaving(false);
    onDone();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (saving) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p className="text-sm text-blue-600 animate-pulse">녹음 저장 중...</p>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center space-y-2">
        <p className="text-sm text-red-600 font-medium">녹음 중 {fmt(elapsed)}</p>
        <button onClick={stopAndSave} className="bg-red-500 text-white rounded-lg px-6 py-2 text-sm font-medium">
          녹음 완료
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
    >
      재녹음하기
    </button>
  );
}
