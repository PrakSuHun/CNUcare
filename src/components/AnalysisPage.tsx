"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { STAGE_LABELS } from "@/lib/stages";
import { parseFiles, type ParsedImage, type ParsedSheet } from "@/lib/parseUpload";
import { renderMarkdown } from "@/lib/miniMarkdown";
import Dashboard from "./Dashboard";

interface Report {
  id: string;
  type: string;
  target_name: string;
  content: string;
  status: string;
  created_at: string;
}

interface SelectOption {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<string, string> = {
  life: "생명 분석",
  student: "전도자 분석",
  manager: "팀 분석",
  overall: "전체 분석",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  life: "개별 생명의 상태, 반응 동향, 성격 파악, 다음 단계 제안",
  student: "전도자의 전도 스타일, 장단점, 페일 패턴 분석",
  manager: "팀 현황, 팀워크, 병목 구간 분석",
  overall: "전체 조직의 성과, 병목, 전략적 개선 제안",
};

const TYPE_COLORS: Record<string, string> = {
  life: "border-blue-300 bg-blue-50",
  student: "border-indigo-300 bg-indigo-50",
  manager: "border-purple-300 bg-purple-50",
  overall: "border-green-300 bg-green-50",
};

export default function AnalysisPage() {
  const [tab, setTab] = useState<"new" | "history" | "lecture" | "chat">("new");
  const [showDashboard, setShowDashboard] = useState(false);
  const [lectureLife, setLectureLife] = useState("");
  const [allLives, setAllLives] = useState<{ id: string; name: string; stage: string }[]>([]);
  const [lectureReactions, setLectureReactions] = useState<any[]>([]);
  const [loadingLecture, setLoadingLecture] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [targets, setTargets] = useState<SelectOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [lectureSearch, setLectureSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  // 채팅 (계정별 기록 + 백그라운드 답변; 명단분석과 공유)
  type ChatMsg = { id?: string; role: "user" | "ai"; text: string; files?: string[]; status?: string };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatImages, setChatImages] = useState<ParsedImage[]>([]);
  const [chatSheets, setChatSheets] = useState<ParsedSheet[]>([]);
  const [chatEngine, setChatEngine] = useState<"claude" | "gemini">("claude");
  const [parsingFiles, setParsingFiles] = useState(false);
  const [chatConvId, setChatConvId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<{ id: string; title: string; updated_at: string }[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatShellRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loginId = () => getUser()?.login_id || "";
  const [kbFixed, setKbFixed] = useState(false); // 키보드 열림(입력 포커스) → 채팅 셸을 보이는 영역에 고정

  // 키보드가 뜨면 visualViewport 크기에 맞춰 채팅 셸을 화면 보이는 영역에 고정(iOS 대응)
  useEffect(() => {
    const el = chatShellRef.current;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!el) return;
    if (!kbFixed || !vv) {
      el.style.position = ""; el.style.height = ""; el.style.transform = "";
      el.style.left = ""; el.style.right = ""; el.style.top = ""; el.style.zIndex = "";
      el.style.background = ""; el.style.paddingLeft = ""; el.style.paddingRight = "";
      return;
    }
    const apply = () => {
      el.style.position = "fixed";
      el.style.left = "0"; el.style.right = "0"; el.style.top = "0";
      el.style.zIndex = "50";
      el.style.background = "#f9fafb";
      el.style.paddingLeft = "1rem"; el.style.paddingRight = "1rem";
      el.style.height = vv.height + "px";
      el.style.transform = `translateY(${vv.offsetTop}px)`;
      chatEndRef.current?.scrollIntoView({ block: "end" });
    };
    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => { vv.removeEventListener("resize", apply); vv.removeEventListener("scroll", apply); };
  }, [kbFixed]);

  // 대화 목록 로드
  const loadConversations = async () => {
    const lid = loginId();
    if (!lid) return;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", login_id: lid }) });
      const d = await res.json();
      setConversations(d.conversations || []);
    } catch { /* noop */ }
  };

  // 특정 대화 열기 (기록 불러오기)
  const openConversation = async (convId: string) => {
    setShowChatHistory(false);
    setChatConvId(convId);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "history", conversation_id: convId }) });
      const d = await res.json();
      const msgs: ChatMsg[] = (d.messages || []).map((m: any) => ({
        id: m.id, role: m.role === "user" ? "user" : "ai",
        text: m.status === "pending" ? "" : m.content, files: m.files || undefined, status: m.status,
      }));
      setChatMessages(msgs);
      const pending = (d.messages || []).find((m: any) => m.status === "pending");
      if (pending) pollAnswer(pending.id);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "auto" }), 50);
    } catch { /* noop */ }
  };

  const newChat = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setChatConvId(null);
    setChatMessages([]);
    setShowChatHistory(false);
  };

  // pending 답변 폴링 → 완료되면 해당 메시지 갱신
  const pollAnswer = (assistantId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setChatLoading(true);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      try {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "poll", ids: [assistantId] }) });
        const d = await res.json();
        const m = (d.messages || [])[0];
        if (m && m.status !== "pending") {
          setChatMessages((prev) => prev.map((x) => x.id === assistantId ? { ...x, text: m.content, status: m.status } : x));
          setChatLoading(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* keep polling */ }
      if (tries > 160) { setChatLoading(false); if (pollRef.current) clearInterval(pollRef.current); } // ~4분 안전장치
    }, 1500);
  };

  const onChatFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setParsingFiles(true);
    try {
      const { images, sheets, skipped } = await parseFiles(files);
      setChatImages((p) => [...p, ...images].slice(0, 6));
      setChatSheets((p) => [...p, ...sheets].slice(0, 6));
      if (skipped.length) alert(`지원하지 않는 파일은 제외됐어요: ${skipped.join(", ")}\n(이미지·엑셀·CSV만 가능)`);
    } catch {
      alert("파일을 읽지 못했습니다.");
    } finally {
      setParsingFiles(false);
      if (chatFileRef.current) chatFileRef.current.value = "";
    }
  };

  useEffect(() => {
    fetchReports();
    fetchAllLives();
    fetch("/api/process-reports").catch(() => {});
  }, []);

  const fetchAllLives = async () => {
    // 강의 탭 목록은 "실제로 강의를 들은" 생명만 — 강의 일지 또는 강의 진도표 체크가 있는 생명.
    // (1차 만남 등 강의를 안 들은 생명은 제외)
    const [jRes, cRes, lRes] = await Promise.all([
      supabase.from("journals").select("life_id").eq("purpose", "lecture").is("deleted_at", null),
      supabase.from("lesson_checks").select("life_id"),
      supabase.from("lives").select("id, name, stage").eq("is_failed", false).order("name"),
    ]);
    const tookLecture = new Set<string>();
    (jRes.data || []).forEach((j: any) => { if (j.life_id) tookLecture.add(j.life_id); });
    (cRes.data || []).forEach((c: any) => { if (c.life_id) tookLecture.add(c.life_id); });
    if (lRes.data) setAllLives(lRes.data.filter((l: any) => tookLecture.has(l.id)));
  };

  const fetchLectureReactions = async (lifeId: string) => {
    setLoadingLecture(true);
    setLectureLife(lifeId);
    const { data: checks } = await supabase
      .from("lesson_checks").select("*, lesson:lessons(number, name, level)").eq("life_id", lifeId).order("created_at");
    const { data: journals } = await supabase
      .from("journals").select("lesson_id, met_date, instructor_name, response")
      .eq("life_id", lifeId).eq("purpose", "lecture").is("deleted_at", null).order("met_date");
    const jMap = new Map<string, any>();
    journals?.forEach((j: any) => { if (j.lesson_id && !jMap.has(j.lesson_id)) jMap.set(j.lesson_id, j); });
    const result = (checks || []).map((c: any) => ({
      lesson_number: c.lesson?.number || 0, lesson_name: c.lesson?.name || "",
      lesson_level: c.lesson?.level || "", attended_date: c.attended_date,
      instructor_name: c.instructor_name, is_passed: c.is_passed, note: c.note,
      journal_response: jMap.get(c.lesson_id)?.response || null,
      journal_date: jMap.get(c.lesson_id)?.met_date || null,
    })).sort((a: any, b: any) => a.lesson_number - b.lesson_number);
    setLectureReactions(result);
    setLoadingLecture(false);
  };

  useEffect(() => {
    if (selectedType && selectedType !== "overall") fetchTargets();
  }, [selectedType]);

  // pending이 있으면 10초마다 갱신
  useEffect(() => {
    const hasPending = reports.some((r) => r.status === "pending" || r.status === "processing");
    if (!hasPending) return;
    const interval = setInterval(() => {
      fetchReports();
      fetch("/api/process-reports").catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [reports]);

  const fetchTargets = async () => {
    if (selectedType === "life") {
      const { data } = await supabase.from("lives").select("id, name").eq("is_failed", false).order("name");
      setTargets((data || []).map((l: any) => ({ id: l.id, name: l.name })));
    } else if (selectedType === "student") {
      const { data } = await supabase.from("users").select("id, display_name").eq("role", "student").order("display_name");
      setTargets((data || []).map((u: any) => ({ id: u.id, name: u.display_name })));
    } else if (selectedType === "manager") {
      const { data } = await supabase.from("users").select("id, display_name").eq("role", "manager").order("display_name");
      setTargets((data || []).map((u: any) => ({ id: u.id, name: u.display_name })));
    }
    setSelectedTarget("");
  };

  const fetchReports = async () => {
    // 행사(event) 리포트는 각 행사 화면에서 보므로 이 목록에서는 제외
    const { data } = await supabase.from("reports").select("*").neq("type", "event").order("created_at", { ascending: false }).limit(50);
    if (data) setReports(data);
  };

  // 보고서 커스텀(재분석) — 추가 요청을 반영해 다시 pending 처리
  const runCustom = async () => {
    if (!viewingReport || !customText.trim()) return;
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "custom", reportId: viewingReport.id, instruction: customText.trim() }),
    });
    const data = await res.json();
    if (data.id) {
      setCustomOpen(false);
      setCustomText("");
      setViewingReport({ ...viewingReport, status: "pending" });
      fetchReports(); // pending 반영 → 폴링 effect가 완료까지 갱신
    }
  };

  // 목록이 갱신되면 열람 중인 보고서도 최신 상태로 동기화(재분석 완료 반영)
  useEffect(() => {
    if (!viewingReport) return;
    const fresh = reports.find((r) => r.id === viewingReport.id);
    if (fresh && (fresh.status !== viewingReport.status || fresh.content !== viewingReport.content)) {
      setViewingReport(fresh);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports]);

  const handleAnalyze = async () => {
    const user = getUser();
    if (!user) return;
    setSubmitting(true);
    setError("");

    const targetName = selectedType === "overall"
      ? "전체 조직"
      : targets.find((t) => t.id === selectedTarget)?.name || "";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          targetId: selectedType === "overall" ? null : selectedTarget,
          targetName,
          createdBy: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "분석 요청에 실패했습니다.");
      } else {
        await fetchReports();
        setTab("history");
        setSelectedType("");
        setSelectedTarget("");
      }
    } catch {
      setError("서버 연결에 실패했습니다.");
    }
    setSubmitting(false);
  };

  // 채팅 전송 (백그라운드 답변 → 폴링)
  const handleChat = async () => {
    const msg = chatInput.trim();
    const hasFiles = chatImages.length > 0 || chatSheets.length > 0;
    if ((!msg && !hasFiles) || chatLoading) return;
    const lid = loginId();
    if (!lid) { alert("로그인이 필요합니다."); return; }

    const fileNames = [...chatImages.map((i) => i.name), ...chatSheets.map((s) => s.name)];
    const media = chatImages.map((i) => ({ mime: i.mime, data: i.data })); // 이미지+PDF
    const sheets = chatSheets.map((s) => ({ name: s.name, text: s.text, rows: s.rows, headers: s.headers }));
    setChatInput("");
    setChatImages([]);
    setChatSheets([]);
    // 낙관적 표시: 사용자 메시지 + 대기 답변
    setChatMessages((prev) => [...prev, { role: "user", text: msg, files: fileNames.length ? fileNames : undefined }, { role: "ai", text: "", status: "pending" }]);
    setChatLoading(true);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login_id: lid, cnu_user_id: getUser()?.id || "", conversation_id: chatConvId, message: msg, engine: chatEngine, media, sheets, fileNames }),
      });
      const data = await res.json();
      if (data.error || !data.assistant_id) {
        setChatMessages((prev) => prev.map((x, i) => i === prev.length - 1 ? { ...x, text: data.error || "요청 실패", status: "error" } : x));
        setChatLoading(false);
        return;
      }
      if (!chatConvId) setChatConvId(data.conversation_id);
      // 대기 메시지에 실제 id 연결 후 폴링
      setChatMessages((prev) => prev.map((x, i) => i === prev.length - 1 ? { ...x, id: data.assistant_id } : x));
      pollAnswer(data.assistant_id);
      loadConversations();
    } catch {
      setChatMessages((prev) => prev.map((x, i) => i === prev.length - 1 ? { ...x, text: "서버 연결에 실패했습니다.", status: "error" } : x));
      setChatLoading(false);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("이 보고서를 삭제하시겠습니까?")) return;
    await supabase.from("reports").delete().eq("id", reportId);
    setViewingReport(null);
    fetchReports();
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${viewingReport?.target_name || "보고서"} - CNUcare 분석 보고서</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const canAnalyze = selectedType === "overall" || (selectedType && selectedTarget);

  const selectTab = (t: "new" | "history" | "lecture" | "chat") => {
    setShowDashboard(false);
    setTab(t);
    if (t === "new") setViewingReport(null);
    if (t === "chat") loadConversations();
  };

  // 폴링 인터벌 정리 (언마운트)
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* 탭 바 — 현황 + 4개 분석을 한 줄로 (모바일 세로 공간 절약) */}
      <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden text-xs shrink-0">
        <button
          onClick={() => setShowDashboard(true)}
          className={`flex-1 py-2.5 px-1 font-medium text-center transition-colors ${
            showDashboard ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          📊 현황
        </button>
        <button
          onClick={() => selectTab("new")}
          className={`flex-1 py-2.5 px-1 font-medium text-center transition-colors ${
            !showDashboard && tab === "new" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          새 분석
        </button>
        <button
          onClick={() => selectTab("history")}
          className={`flex-1 py-2.5 px-1 font-medium text-center transition-colors ${
            !showDashboard && tab === "history" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          보고서 ({reports.length})
        </button>
        <button
          onClick={() => selectTab("lecture")}
          className={`flex-1 py-2.5 px-1 font-medium text-center transition-colors ${
            !showDashboard && tab === "lecture" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          강의
        </button>
        <button
          onClick={() => selectTab("chat")}
          className={`flex-1 py-2.5 px-1 font-medium text-center transition-colors ${
            !showDashboard && tab === "chat" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          채팅
        </button>
      </div>

      {/* 콘텐츠 영역 — 채팅일 땐 내부 스크롤만(부모 스크롤 방지), 그 외엔 세로 스크롤 */}
      <div className={`flex-1 min-h-0 ${!showDashboard && tab === "chat" ? "overflow-hidden" : "overflow-y-auto"}`}>

      {showDashboard && <Dashboard />}

      {/* 새 분석 */}
      {!showDashboard && tab === "new" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setSelectedType(key); setError(""); }}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  selectedType === key ? TYPE_COLORS[key] + " border-current" : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm font-bold">{label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{TYPE_DESCRIPTIONS[key]}</p>
              </button>
            ))}
          </div>

          {selectedType && selectedType !== "overall" && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder={selectedType === "life" ? "생명 이름 검색" : selectedType === "student" ? "전도자 이름 검색" : "관리자 이름 검색"}
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              />
              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {targets
                  .filter((t) => !targetSearch || t.name.toLowerCase().includes(targetSearch.toLowerCase()))
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTarget(t.id)}
                      style={{ touchAction: "manipulation" }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 ${selectedTarget === t.id ? "bg-blue-100 font-semibold text-blue-700" : ""}`}
                    >
                      {t.name}
                    </button>
                  ))}
                {targets.filter((t) => !targetSearch || t.name.toLowerCase().includes(targetSearch.toLowerCase())).length === 0 && (
                  <p className="text-center text-xs text-gray-400 py-4">검색 결과가 없습니다</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze || submitting}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "요청 중..." : "분석 시작"}
          </button>
        </div>
      )}

      {/* 보고서 이력 */}
      {!showDashboard && tab === "history" && !viewingReport && (
        <div className="space-y-2">
          {reports.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">저장된 보고서가 없습니다.</p>
          )}
          {reports.map((r) => {
            const isPending = r.status === "pending" || r.status === "processing";
            const isFailed = r.status === "failed";
            return (
              <div key={r.id} className={`rounded-lg border p-3 ${
                isPending ? "bg-blue-50 border-blue-200" : isFailed ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
              }`}>
                <div className="flex items-start justify-between">
                  <button
                    onClick={() => { if (!isPending) { setViewingReport(r); setCustomOpen(false); setCustomText(""); } }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        r.type === "life" ? "bg-blue-100 text-blue-700" :
                        r.type === "student" ? "bg-indigo-100 text-indigo-700" :
                        r.type === "manager" ? "bg-purple-100 text-purple-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {TYPE_LABELS[r.type]}
                      </span>
                      <span className="text-sm font-medium">{r.target_name}</span>
                      {isPending && (
                        <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full animate-pulse">분석 중</span>
                      )}
                      {isFailed && (
                        <span className="text-[10px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded-full">실패</span>
                      )}
                    </div>
                    {isPending && (
                      <p className="text-xs text-blue-500 mt-1 italic">Claude가 분석 중입니다...</p>
                    )}
                    {!isPending && !isFailed && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                        {r.content.replace(/<[^>]*>/g, "").slice(0, 80)}...
                      </p>
                    )}
                  </button>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <span className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString("ko-KR")}
                    </span>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-gray-300 hover:text-red-400"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 보고서 상세 보기 */}
      {!showDashboard && viewingReport && tab === "history" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                viewingReport.type === "life" ? "bg-blue-100 text-blue-700" :
                viewingReport.type === "student" ? "bg-indigo-100 text-indigo-700" :
                viewingReport.type === "manager" ? "bg-purple-100 text-purple-700" :
                "bg-green-100 text-green-700"
              }`}>
                {TYPE_LABELS[viewingReport.type]}
              </span>
              <span className="text-sm font-bold">{viewingReport.target_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="text-xs text-blue-500 border border-blue-300 rounded-full px-3 py-1 hover:bg-blue-50"
              >
                출력
              </button>
              <button
                onClick={() => handleDelete(viewingReport.id)}
                className="text-xs text-red-400 border border-red-200 rounded-full px-3 py-1 hover:bg-red-50"
              >
                삭제
              </button>
              <button onClick={() => setViewingReport(null)} className="text-xs text-gray-500">← 목록</button>
            </div>
          </div>
          {viewingReport.status === "pending" || viewingReport.status === "processing" ? (
            <div className="py-12 text-center space-y-2">
              <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">다시 분석하고 있어요…</p>
              <p className="text-xs text-gray-400">완료되면 이 화면이 자동으로 갱신됩니다</p>
            </div>
          ) : (
            <>
              <div ref={printRef} dangerouslySetInnerHTML={{ __html: extractHtml(viewingReport.content) }} />

              {/* 레포트 커스텀 — 세밀한 부분 재분석 */}
              <div className="mt-4 border-t border-gray-100 pt-4">
                {!customOpen ? (
                  <button onClick={() => setCustomOpen(true)}
                    className="w-full border border-indigo-300 text-indigo-600 rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-50">
                    레포트 커스텀
                  </button>
                ) : (
                  <div className="space-y-2 border border-indigo-200 rounded-lg p-3 bg-indigo-50/40">
                    <p className="text-xs text-gray-600">더 깊게 보고 싶은 부분을 적어주세요. 그 방향으로 다시 분석해요.</p>
                    <textarea
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      rows={3}
                      placeholder="예: 최근 3개월 반응 변화에 집중해서 다시 분석하고, 다음 만남에서 쓸 구체적 질문 5개를 제안해줘"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                    />
                    <div className="flex gap-2">
                      <button onClick={runCustom} disabled={!customText.trim()}
                        className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                        이 방향으로 재분석
                      </button>
                      <button onClick={() => { setCustomOpen(false); setCustomText(""); }}
                        className="border border-gray-200 text-gray-500 rounded-lg py-2 px-3 text-sm hover:bg-gray-50">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {/* 강의 반응 정리 */}
      {!showDashboard && tab === "lecture" && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="생명 이름 검색"
            value={lectureSearch}
            onChange={(e) => setLectureSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          />
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
            {allLives
              .filter((l) => !lectureSearch || l.name.toLowerCase().includes(lectureSearch.toLowerCase()))
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => fetchLectureReactions(l.id)}
                  style={{ touchAction: "manipulation" }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 ${lectureLife === l.id ? "bg-blue-100 font-semibold text-blue-700" : ""}`}
                >
                  {l.name} <span className="text-xs text-gray-400">({STAGE_LABELS[l.stage] || l.stage})</span>
                </button>
              ))}
            {allLives.filter((l) => !lectureSearch || l.name.toLowerCase().includes(lectureSearch.toLowerCase())).length === 0 && (
              <p className="text-center text-xs text-gray-400 py-4">검색 결과가 없습니다</p>
            )}
          </div>
          {loadingLecture && <p className="text-center text-sm text-gray-400 py-4">로딩 중...</p>}
          {!loadingLecture && lectureLife && lectureReactions.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">수강 기록이 없습니다.</p>
          )}
          {lectureReactions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">수강 강의 {lectureReactions.length}개</p>
              {lectureReactions.map((r: any, i: number) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold">{r.lesson_number}. {r.lesson_name}</span>
                      {r.is_passed && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">패스</span>}
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      {({ intro: "입문", beginner: "초급", intermediate: "중급", advanced: "고급" } as Record<string, string>)[r.lesson_level] || r.lesson_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    {r.attended_date && <span>{r.attended_date}</span>}
                    {r.instructor_name && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">강사: {r.instructor_name}</span>}
                  </div>
                  {(r.note || r.journal_response) ? (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 mb-1 font-medium">생명 반응</p>
                      {r.note && <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.note}</p>}
                      {r.journal_response && r.journal_response !== r.note && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{r.journal_response}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300">반응 기록 없음</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI 채팅 — 콘텐츠 영역을 꽉 채우는 flex 셸. 높이는 visualViewport로 바인딩(키보드 대응). */}
      {!showDashboard && tab === "chat" && (
        <div ref={chatShellRef} className="flex flex-col min-h-0 h-full">
          {/* 상단: 새 대화 / 기록 */}
          <div className="flex items-center justify-between pb-2 shrink-0">
            <button onClick={newChat} className="text-xs font-medium text-blue-600 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-50">
              + 새 대화
            </button>
            <div className="relative">
              <button onClick={() => { setShowChatHistory((v) => !v); loadConversations(); }} className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-50">
                기록 {conversations.length > 0 && `(${conversations.length})`}
              </button>
              {showChatHistory && (
                <div className="absolute right-0 top-full mt-1 w-64 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  {conversations.length === 0 && <p className="text-xs text-gray-400 text-center py-4">기록이 없습니다</p>}
                  {conversations.map((c) => (
                    <div key={c.id} className={`flex items-center gap-1 px-2 py-1.5 hover:bg-gray-50 ${chatConvId === c.id ? "bg-blue-50" : ""}`}>
                      <button onClick={() => openConversation(c.id)} className="flex-1 min-w-0 text-left">
                        <span className="text-sm text-gray-800 block truncate">{c.title || "제목 없음"}</span>
                        <span className="text-[10px] text-gray-400">{new Date(c.updated_at).toLocaleDateString("ko-KR")}</span>
                      </button>
                      <button
                        onClick={async () => { await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", login_id: loginId(), conversation_id: c.id }) }); if (chatConvId === c.id) newChat(); loadConversations(); }}
                        className="text-gray-300 hover:text-red-400 text-xs px-1 shrink-0"
                      >삭제</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">데이터·명단에 대해 자유롭게 질문해보세요</p>
                <p className="text-gray-300 text-xs mt-1">명단 파일(이미지·엑셀·PDF)을 올리고 “조회해줘” 하면 중복 의심자를 뽑아줍니다</p>
                <div className="mt-4 space-y-2">
                  {["현재 전도 현황을 요약해줘", "가장 잘 진행되고 있는 생명은?", "이 명단 중복 참여자 조회해줘"].map((q) => (
                    <button key={q} onClick={() => { setChatInput(q); }} className="block mx-auto text-xs text-blue-500 border border-blue-200 rounded-full px-4 py-1.5 hover:bg-blue-50">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={msg.id || i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user" ? "bg-blue-600 text-white rounded-br-md" : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                }`}>
                  {msg.files && msg.files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {msg.files.map((f, k) => (
                        <span key={k} className={`text-[11px] px-2 py-0.5 rounded-full ${msg.role === "user" ? "bg-blue-500/60" : "bg-gray-100 text-gray-600"}`}>📎 {f}</span>
                      ))}
                    </div>
                  )}
                  {msg.status === "pending" && !msg.text ? (
                    <div className="flex gap-1 py-0.5">
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  ) : msg.role === "ai" && msg.status !== "error" ? (
                    <div className="mdbody" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                  ) : (
                    <div className={`whitespace-pre-wrap ${msg.status === "error" ? "text-red-500" : ""}`}>{msg.text}</div>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* 입력 카드 — 셸 하단 고정(shrink-0). 텍스트 + 하단 툴바(첨부·모델·전송)를 한 박스에 */}
          <div className="shrink-0 bg-gray-50 pt-1" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
            <div className="rounded-2xl border border-gray-300 bg-white shadow-sm focus-within:border-blue-400 transition-colors">
              {/* 첨부 파일 칩 */}
              {(chatImages.length > 0 || chatSheets.length > 0 || parsingFiles) && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  {chatImages.map((img, i) => (
                    <span key={"i" + i} className="flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2 py-0.5">
                      {img.kind === "pdf" ? <span className="w-5 h-5 flex items-center justify-center">📄</span> : <img src={img.previewUrl} alt="" className="w-5 h-5 rounded object-cover" />}
                      <span className="max-w-[90px] truncate">{img.name}</span>
                      <button onClick={() => setChatImages((p) => p.filter((_, k) => k !== i))} className="text-gray-400">×</button>
                    </span>
                  ))}
                  {chatSheets.map((s, i) => (
                    <span key={"s" + i} className="flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                      📊 <span className="max-w-[110px] truncate">{s.name}</span>
                      <button onClick={() => setChatSheets((p) => p.filter((_, k) => k !== i))} className="text-gray-400">×</button>
                    </span>
                  ))}
                  {parsingFiles && <span className="text-[11px] text-gray-400 py-0.5">파일 읽는 중…</span>}
                </div>
              )}

              {/* 텍스트 입력 (여러 줄) */}
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                onFocus={() => setKbFixed(true)}
                onBlur={() => setTimeout(() => setKbFixed(false), 80)}
                placeholder="메시지를 입력하세요..."
                rows={2}
                className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm focus:outline-none max-h-40"
              />

              {/* 하단 툴바 */}
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1">
                  <input ref={chatFileRef} type="file" accept="image/*,.xlsx,.xls,.csv,.tsv,.pdf" multiple onChange={(e) => onChatFiles(e.target.files)} className="hidden" />
                  <button type="button" onClick={() => chatFileRef.current?.click()} title="이미지·엑셀·PDF 첨부 (여러 개)"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 text-lg">+</button>
                </div>
                <div className="flex items-center gap-2">
                  <select value={chatEngine} onChange={(e) => setChatEngine(e.target.value as "claude" | "gemini")}
                    title="답변 모델 (이미지·PDF도 Claude 우선, 실패 시 Gemini 자동 폴백)"
                    className="rounded-lg text-xs text-gray-600 bg-transparent px-1 py-1 focus:outline-none cursor-pointer">
                    <option value="claude">Claude</option>
                    <option value="gemini">Gemini</option>
                  </select>
                  <button type="button" onClick={handleChat}
                    disabled={(!chatInput.trim() && chatImages.length === 0 && chatSheets.length === 0) || chatLoading}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700">
                    <span className="text-sm">↑</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function extractHtml(content: string): string {
  const codeBlockMatch = content.match(/```html\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const divMatch = content.match(/<div[\s\S]*<\/div>/);
  if (divMatch) return divMatch[0];

  return content
    .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:bold;margin:16px 0 4px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:bold;margin:20px 0 8px">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
