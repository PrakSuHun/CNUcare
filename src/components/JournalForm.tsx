"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface JournalFormProps {
  lifeId: string;
  journalId?: string;
  backPath: string;
}

export default function JournalForm({ lifeId, journalId, backPath }: JournalFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    met_date: new Date().toISOString().split("T")[0],
    location: "",
    response: "",
  });
  const [loading, setLoading] = useState(!!journalId);
  const [saving, setSaving] = useState(false);
  const isEdit = !!journalId;

  // 녹음 관련
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState("");
  const [showRecordOption, setShowRecordOption] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveHistoryRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/"); return; }
    if (journalId) fetchJournal();
  }, [router, journalId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const fetchJournal = async () => {
    const { data } = await supabase.from("journals").select("*").eq("id", journalId).single();
    if (data) {
      setForm({ met_date: data.met_date, location: data.location, response: data.response });
    }
    setLoading(false);
  };

  // 파형 그리기
  const drawWaveform = useCallback(() => {
    if (!analyserRef.current || !canvasRef.current) return;

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(dataArray);

    // 평균 볼륨 계산
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += Math.abs(dataArray[i] - 128);
    }
    const avg = sum / dataArray.length;
    const normalized = Math.min(avg / 50, 1);
    setAudioLevel(normalized);

    // 파형 히스토리에 추가
    waveHistoryRef.current.push(normalized);
    if (waveHistoryRef.current.length > 200) {
      waveHistoryRef.current.shift();
    }

    // 캔버스 그리기
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const history = waveHistoryRef.current;
    const barWidth = width / 100;
    const startIdx = Math.max(0, history.length - 100);

    for (let i = startIdx; i < history.length; i++) {
      const x = (i - startIdx) * barWidth;
      const barHeight = history[i] * height * 0.8;
      const y = (height - barHeight) / 2;

      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + history[i] * 0.6})`;
      ctx.fillRect(x, y, barWidth - 1, barHeight || 1);
    }

    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  // 녹음 시작
  const startRecording = async () => {
    try {
      setTranscribeError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 오디오 분석기 설정 (파형용)
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      waveHistoryRef.current = [];

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        audioCtx.close();
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        transcribeAudio(blob);
      };

      mediaRecorder.start(100); // 100ms 간격으로 데이터 수집
      setRecording(true);
      setRecordingTime(0);
      setShowRecordOption(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      // 파형 그리기 시작
      drawWaveform();
    } catch {
      alert("마이크 권한을 허용해주세요.");
    }
  };

  // 녹음 중지
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // 파일 업로드
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowRecordOption(false);
    setTranscribeError("");
    transcribeAudio(file);
  };

  // Gemini 변환
  const transcribeAudio = async (audioData: Blob | File) => {
    setTranscribing(true);
    setTranscribeError("");

    const formData = new FormData();
    formData.append("audio", audioData);

    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setTranscribeError(data.error || "변환에 실패했습니다.");
        setTranscribing(false);
        return;
      }

      if (data.result) {
        const r = data.result;
        setForm((f) => ({
          met_date: r.날짜 || f.met_date,
          location: r.만남장소 || f.location,
          response: r.생명반응 || f.response,
        }));
      }
    } catch {
      setTranscribeError("서버 연결에 실패했습니다. 다시 시도해주세요.");
    }

    setTranscribing(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (isEdit) {
      await supabase.from("journals").update({
        met_date: form.met_date,
        location: form.location,
        response: form.response,
      }).eq("id", journalId);
    } else {
      const user = getUser();
      if (!user) return;
      await supabase.from("journals").insert({
        life_id: lifeId,
        author_id: user.id,
        met_date: form.met_date,
        location: form.location,
        response: form.response,
      });
      await supabase.from("lives").update({ last_met_at: form.met_date }).eq("id", lifeId);
    }

    router.push(backPath);
  };

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => router.push(backPath)} className="text-gray-500 mr-3">&larr;</button>
        <h1 className="text-lg font-bold">{isEdit ? "일지 수정" : "일지 작성"}</h1>
      </header>

      <div className="p-4">
        {/* 변환 중 */}
        {transcribing && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="animate-pulse text-blue-600 font-medium text-sm">녹음을 텍스트로 변환 중...</div>
            <p className="text-xs text-blue-400 mt-1">잠시만 기다려주세요</p>
          </div>
        )}

        {/* 변환 에러 */}
        {transcribeError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600 font-medium">변환 실패</p>
            <p className="text-xs text-red-400 mt-1">{transcribeError}</p>
            <button
              onClick={() => setTranscribeError("")}
              className="text-xs text-red-500 underline mt-2"
            >
              닫기
            </button>
          </div>
        )}

        {/* 녹음 중 UI + 파형 */}
        {recording && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-red-600 font-medium text-sm">녹음 중 {formatTime(recordingTime)}</span>
            </div>

            {/* 파형 캔버스 */}
            <canvas
              ref={canvasRef}
              width={300}
              height={60}
              className="w-full h-[60px] rounded bg-red-100/50 mb-3"
            />

            {/* 볼륨 미터 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] text-red-400">볼륨</span>
              <div className="flex-1 bg-red-200 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all duration-100"
                  style={{ width: `${audioLevel * 100}%` }}
                />
              </div>
            </div>

            <button
              onClick={stopRecording}
              className="w-full bg-red-500 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-red-600"
            >
              녹음 중지 → 변환하기
            </button>
          </div>
        )}

        {/* 녹음 옵션 (새 일지만) */}
        {!isEdit && !recording && !transcribing && (
          <div className="mb-4">
            {showRecordOption ? (
              <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <button
                  onClick={startRecording}
                  className="w-full flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-red-50 hover:border-red-300 transition-colors"
                >
                  <span className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center text-red-500 shrink-0">●</span>
                  <div className="text-left">
                    <p className="text-sm font-medium">실시간 녹음</p>
                    <p className="text-xs text-gray-400">바로 녹음을 시작합니다</p>
                  </div>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <span className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 text-xs shrink-0">▲</span>
                  <div className="text-left">
                    <p className="text-sm font-medium">녹음 파일 업로드</p>
                    <p className="text-xs text-gray-400">기존 녹음 파일을 첨부합니다</p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => setShowRecordOption(false)}
                  className="w-full text-center text-xs text-gray-400 py-1"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRecordOption(true)}
                className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-center text-sm text-gray-500 hover:border-red-300 hover:text-red-500 transition-colors"
              >
                녹음으로 작성하기
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
            <input type="date" value={form.met_date} onChange={(e) => setForm((f) => ({ ...f, met_date: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">만남 장소</label>
            <input type="text" placeholder="예: 학교 카페, 도서관 앞" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} required className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">생명 반응</label>
            <textarea placeholder="어떤 대화를 했는지, 생명의 반응은 어떠했는지, 다음 계획은 무엇인지 자유롭게 작성해주세요." value={form.response} onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))} required rows={8} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>
          <button type="submit" disabled={saving || transcribing} className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "저장 중..." : isEdit ? "수정 완료" : "일지 저장"}
          </button>
        </form>
      </div>
    </div>
  );
}
