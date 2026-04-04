"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { STAGE_LABELS } from "@/lib/stages";

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
  const [lectureLife, setLectureLife] = useState("");
  const [allLives, setAllLives] = useState<{ id: string; name: string; stage: string }[]>([]);
  const [lectureReactions, setLectureReactions] = useState<any[]>([]);
  const [loadingLecture, setLoadingLecture] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [targets, setTargets] = useState<SelectOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  // 채팅
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchReports();
    fetchAllLives();
    fetch("/api/process-reports").catch(() => {});
  }, []);

  const fetchAllLives = async () => {
    const { data } = await supabase.from("lives").select("id, name, stage").eq("is_failed", false).order("name");
    if (data) setAllLives(data);
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
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(50);
    if (data) setReports(data);
  };

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

  // 채팅 전송
  const handleChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "ai", text: data.reply || data.error || "답변 실패" }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "ai", text: "서버 연결에 실패했습니다." }]);
    }
    setChatLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => { setTab("new"); setViewingReport(null); }}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            tab === "new" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          새 분석
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            tab === "history" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          보고서 ({reports.length})
        </button>
        <button
          onClick={() => setTab("lecture")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            tab === "lecture" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          강의 반응
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            tab === "chat" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          AI 채팅
        </button>
      </div>

      {/* 새 분석 */}
      {tab === "new" && (
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
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
            >
              <option value="">
                {selectedType === "life" ? "생명 선택" : selectedType === "student" ? "전도자 선택" : "관리자 선택"}
              </option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
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
      {tab === "history" && !viewingReport && (
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
                    onClick={() => !isPending && setViewingReport(r)}
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
      {viewingReport && tab === "history" && (
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
          <div ref={printRef} dangerouslySetInnerHTML={{ __html: extractHtml(viewingReport.content) }} />
        </div>
      )}
      {/* 강의 반응 정리 */}
      {tab === "lecture" && (
        <div className="space-y-3">
          <select value={lectureLife}
            onChange={(e) => { if (e.target.value) fetchLectureReactions(e.target.value); else { setLectureLife(""); setLectureReactions([]); } }}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none">
            <option value="">생명 선택</option>
            {allLives.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({STAGE_LABELS[l.stage] || l.stage})</option>
            ))}
          </select>
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

      {/* AI 채팅 */}
      {tab === "chat" && (
        <div className="flex flex-col" style={{ height: "calc(100vh - 220px)" }}>
          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 text-sm">데이터에 대해 자유롭게 질문해보세요</p>
                <div className="mt-4 space-y-2">
                  {[
                    "현재 전도 현황을 요약해줘",
                    "가장 잘 진행되고 있는 생명은?",
                    "페일 비율이 높은 이유는?",
                    "1차 만남에서 전초로 넘어가려면?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      className="block mx-auto text-xs text-blue-500 border border-blue-200 rounded-full px-4 py-1.5 hover:bg-blue-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                }`}>
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="border-t border-gray-200 pt-3">
            <form
              onSubmit={(e) => { e.preventDefault(); handleChat(); }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="질문을 입력하세요..."
                className="flex-1 rounded-full border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="bg-blue-600 text-white rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-blue-700 shrink-0"
              >
                전송
              </button>
            </form>
          </div>
        </div>
      )}
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
