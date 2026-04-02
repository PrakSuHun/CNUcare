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
  const [showRecordOption, setShowRecordOption] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
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

  // Supabase에 녹음 업로드
  const uploadAudio = async (audioData: Blob | File): Promise<string | null> => {
    const ext = audioData.type?.includes("mp4") ? "mp4" : "webm";
    const fileName = `${lifeId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("recordings")
      .upload(fileName, audioData, { contentType: audioData.type || "audio/webm" });
    if (error) return null;
    const { data: urlData } = supabase.storage.from("recordings").getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  // 파형
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        audioCtx.close();
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        setShowRecordModal(false);

        // Supabase Storage에 저장만
        setUploading(true);
        const url = await uploadAudio(blob);
        if (url) setAudioUrl(url);
        setUploading(false);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowRecordOption(false);
    setUploading(true);
    const url = await uploadAudio(file);
    if (url) setAudioUrl(url);
    setUploading(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, "0")}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const user = getUser();
    if (!user) return;

    const journalData: any = {
      met_date: form.met_date,
      location: form.location,
      response: form.response || null,
      purpose: form.purpose || null,
      lesson_id: form.lesson_id || null,
      audio_url: audioUrl,
    };

    if (isEdit) {
      await supabase.from("journals").update(journalData).eq("id", journalId);
    } else {
      // 일지 저장
      const { data: newJournal } = await supabase.from("journals").insert({
        life_id: lifeId,
        author_id: user.id,
        ...journalData,
      }).select("id").single();

      await supabase.from("lives").update({ last_met_at: form.met_date }).eq("id", lifeId);

      // 강의 선택 시 자동 체크
      if (form.purpose === "lecture" && form.lesson_id) {
        await supabase.from("lesson_checks").upsert({
          life_id: lifeId,
          lesson_id: form.lesson_id,
          attended_date: form.met_date,
        }, { onConflict: "life_id,lesson_id" });
      }

      // 녹음이 있고 내용이 비어있으면 → 작업 큐에 등록 (백엔드에서 나중에 변환)
      if (audioUrl && !form.response && newJournal) {
        await supabase.from("audio_queue").insert({
          audio_url: audioUrl,
          life_id: lifeId,
          requester_id: user.id,
          status: "pending",
        });
      }
    }

    router.push(backPath);
  };

  if (loading) {
    return <div className="flex min-h-full items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  const lectureOnlyLessons = lessons.filter((l) => l.category === "lecture");
  // 녹음만 있고 내용 없으면 response를 필수에서 해제
  const responseRequired = !audioUrl;

  return (
    <div className="min-h-full bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <button onClick={() => router.push(backPath)} className="text-gray-500 mr-3">&larr;</button>
        <h1 className="text-lg font-bold">{isEdit ? "일지 수정" : "일지 작성"}</h1>
      </header>

      <div className="p-4">
        {/* 업로드 중 */}
        {uploading && (
          <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
            <div className="animate-pulse text-gray-600 font-medium text-sm">녹음 파일 저장 중...</div>
          </div>
        )}

        {/* 녹음 저장 완료 표시 */}
        {audioUrl && !uploading && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-700 text-sm font-medium">녹음 저장 완료</span>
            </div>
            <audio src={audioUrl} controls className="w-full h-8" />
            <p className="text-xs text-green-600 mt-2">
              내용을 직접 작성하거나, 비워두고 저장하면 자동으로 텍스트 변환됩니다.
            </p>
          </div>
        )}

        {/* 녹음 옵션 */}
        {!isEdit && !recording && !uploading && (
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              생명 반응 {audioUrl && <span className="text-xs text-gray-400 font-normal">(비워두면 자동 변환)</span>}
            </label>
            <textarea
              placeholder={audioUrl ? "비워두면 녹음에서 자동으로 텍스트가 채워집니다." : "어떤 대화를 했는지, 생명의 반응은 어떠했는지, 다음 계획은 무엇인지 자유롭게 작성해주세요."}
              value={form.response}
              onChange={(e) => setForm((f) => ({ ...f, response: e.target.value }))}
              required={responseRequired}
              rows={8}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
          <button type="submit" disabled={saving || uploading} className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "저장 중..." : isEdit ? "수정 완료" : audioUrl && !form.response ? "녹음 저장 (자동 변환 예약)" : "일지 저장"}
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
                    <span className="text-blue-400 shrink-0 mt-0.5">•</span>{g}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={stopRecording}
              className="w-full bg-red-500 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-600 transition-colors"
            >
              녹음 중지
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
