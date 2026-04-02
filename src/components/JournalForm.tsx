"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface Lesson {
  id: string;
  number: number;
  name: string;
  level: string;
  category: string;
}

interface JournalFormProps {
  lifeId: string;
  journalId?: string;
  backPath: string;
}

const PURPOSE_OPTIONS = [
  { value: "first_meeting", label: "1차 만남" },
  { value: "pre_visit", label: "전초" },
  { value: "management", label: "관리" },
  { value: "lecture", label: "강의" },
];

const RECORD_GUIDE = [
  "생명의 현재 상태는 어떤가요?",
  "생명의 반응은 어땠나요?",
  "대화 중 인상 깊었던 점은?",
  "좋았던 점은 무엇인가요?",
  "아쉬웠던 점이나 어려운 점은?",
  "앞으로의 계획은?",
];

export default function JournalForm({ lifeId, journalId, backPath }: JournalFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    met_date: new Date().toISOString().split("T")[0],
    location: "",
    purpose: "",
    lesson_id: "",
    response: "",
  });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(!!journalId);
  const [saving, setSaving] = useState(false);
  const isEdit = !!journalId;

  // 녹음
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
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
  const audioCtxRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveHistoryRef = useRef<number[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/"); return; }
    if (journalId) fetchJournal();
    fetchLessons();
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
      setForm({
        met_date: data.met_date,
        location: data.location,
        purpose: data.purpose || "",
        lesson_id: data.lesson_id || "",
        response: data.response,
      });
      if (data.audio_url) setAudioUrl(data.audio_url);
    }
    setLoading(false);
  };

  const fetchLessons = async () => {
    const { data } = await supabase.from("lessons").select("id, number, name, level, category").order("sort_order");
    if (data) setLessons(data);
  };

  // Supabase에 녹음 파일 업로드
  const uploadAudio = async (audioData: Blob | File): Promise<string | null> => {
    setUploading(true);
    const ext = audioData.type?.includes("mp4") ? "mp4" : "webm";
    const fileName = `${lifeId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("recordings")
      .upload(fileName, audioData, { contentType: audioData.type || "audio/webm" });

    setUploading(false);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(fileName);
    return urlData.publicUrl;
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

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += Math.abs(dataArray[i] - 128);
    const normalized = Math.min(sum / dataArray.length / 50, 1);
    setAudioLevel(normalized);

    waveHistoryRef.current.push(normalized);
    if (waveHistoryRef.current.length > 200) waveHistoryRef.current.shift();

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const history = waveHistoryRef.current;
    const barWidth = width / 100;
    const startIdx = Math.max(0, history.length - 100);

    for (let i = startIdx; i < history.length; i++) {
      const x = (i - startIdx) * barWidth;
      const barHeight = history[i] * height * 0.8;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + history[i] * 0.6})`;
      ctx.fillRect(x, (height - barHeight) / 2, barWidth - 1, barHeight || 1);
    }
    animFrameRef.current = requestAnimationFrame(drawWaveform);
  }, []);

  // 녹음 시작
  const startRecording = async () => {
    try {
      setTranscribeError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
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

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        audioCtx.close();
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setShowRecordModal(false);
        await handleAudioReady(blob);
      };

      mediaRecorder.start(100);
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      drawWaveform();
    } catch {
      alert("마이크 권한을 허용해주세요.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowRecordOption(false);
    setTranscribeError("");
    handleAudioReady(file);
  };

  // 녹음/파일 준비 → Supabase 저장 → 변환 시도
  const handleAudioReady = async (audioData: Blob | File) => {
    // 1. Supabase Storage에 먼저 저장
    setUploading(true);
    const url = await uploadAudio(audioData);
    if (url) {
      setAudioUrl(url);
    }
    setUploading(false);

    // 2. Gemini 변환 시도
    setTranscribing(true);
    const fd = new FormData();
    fd.append("audio", audioData);

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setTranscribeError(data.error || "변환에 실패했습니다. 직접 작성해주세요.");
        setTranscribing(false);
        return;
      }

      if (data.result) {
        const r = data.result;
        setForm((f) => ({
          ...f,
          met_date: r.날짜 || f.met_date,
          location: r.만남장소 || f.location,
          response: r.생명반응 || f.response,
        }));
      }
    } catch {
      setTranscribeError("변환에 실패했습니다. 녹음은 저장되었으니 직접 작성해주세요.");
    }

    setTranscribing(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const journalData: any = {
      met_date: form.met_date,
      location: form.location,
      response: form.response,
      purpose: form.purpose || null,
      lesson_id: form.lesson_id || null,
      audio_url: audioUrl,
    };

    if (isEdit) {
      await supabase.from("journals").update(journalData).eq("id", journalId);
    } else {
      const user = getUser();
      if (!user) return;
      await supabase.from("journals").insert({
        life_id: lifeId,
        author_id: user.id,
        ...journalData,
      });
      await supabase.from("lives").update({ last_met_at: form.met_date }).eq("id", lifeId);

      if (form.purpose === "lecture" && form.lesson_id) {
        await supabase.from("lesson_checks").upsert({
          life_id: lifeId,
          lesson_id: form.lesson_id,
          attended_date: form.met_date,
        }, { onConflict: "life_id,lesson_id" });
      }
    }

    router.push(backPath);
  };

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  const lectureOnlyLessons = lessons.filter((l) => l.category === "lecture");

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => router.push(backPath)} className="text-gray-500 mr-3">&larr;</button>
        <h1 className="text-lg font-bold">{isEdit ? "일지 수정" : "일지 작성"}</h1>
      </header>

      <div className="p-4">
        {/* 상태 표시 */}
        {uploading && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="animate-pulse text-gray-600 font-medium text-sm">녹음 파일 저장 중...</div>
          </div>
        )}

        {transcribing && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="animate-pulse text-blue-600 font-medium text-sm">텍스트로 변환 중...</div>
            <p className="text-xs text-blue-400 mt-1">실패해도 녹음은 이미 저장되었습니다</p>
          </div>
        )}

        {transcribeError && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 font-medium">자동 변환 실패</p>
            <p className="text-xs text-yellow-600 mt-1">{transcribeError}</p>
            {audioUrl && <p className="text-xs text-green-600 mt-1">녹음 파일은 저장되었습니다.</p>}
            <button onClick={() => setTranscribeError("")} className="text-xs text-yellow-600 underline mt-2">닫기</button>
          </div>
        )}

        {/* 녹음 파일 표시 */}
        {audioUrl && !uploading && !transcribing && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-sm">녹음 저장됨</span>
            </div>
            <audio src={audioUrl} controls className="h-8" />
          </div>
        )}

        {/* 녹음 옵션 */}
        {!isEdit && !recording && !transcribing && !uploading && (
          <div className="mb-4">
            {showRecordOption ? (
              <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                <button
                  onClick={() => { setShowRecordOption(false); setShowRecordModal(true); startRecording(); }}
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
                <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                <button onClick={() => setShowRecordOption(false)} className="w-full text-center text-xs text-gray-400 py-1">취소</button>
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
          {/* 목적 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">목적</label>
            <div className="grid grid-cols-4 gap-2">
              {PURPOSE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, purpose: opt.value, lesson_id: opt.value !== "lecture" ? "" : f.lesson_id }))}
                  className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.purpose === opt.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.purpose === "lecture" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수강 강의</label>
              <select
                value={form.lesson_id}
                onChange={(e) => setForm((f) => ({ ...f, lesson_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">강의를 선택하세요</option>
                {lectureOnlyLessons.map((l) => (
                  <option key={l.id} value={l.id}>{l.number}. {l.name}</option>
                ))}
              </select>
            </div>
          )}

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
          <button type="submit" disabled={saving || transcribing || uploading} className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "저장 중..." : isEdit ? "수정 완료" : "일지 저장"}
          </button>
        </form>
      </div>

      {/* 녹음 팝업 모달 */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-red-600 font-bold text-lg">녹음 중 {formatTime(recordingTime)}</span>
              </div>
            </div>

            <canvas ref={canvasRef} width={350} height={70} className="w-full h-[70px] rounded-lg bg-red-50" />

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 shrink-0">볼륨</span>
              <div className="flex-1 bg-red-100 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full transition-all duration-100" style={{ width: `${audioLevel * 100}%` }} />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-600 mb-2">이런 내용을 말해보세요</p>
              <ul className="space-y-1.5">
                {RECORD_GUIDE.map((g, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-2">
                    <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                    {g}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={stopRecording}
              className="w-full bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
            >
              녹음 중지 → 저장 및 변환
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
