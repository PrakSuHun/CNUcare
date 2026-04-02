"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface Report {
  id: string;
  type: string;
  target_name: string;
  content: string;
  created_at: string;
}

interface SelectOption {
  id: string;
  name: string;
}

const TYPE_LABELS: Record<string, string> = {
  life: "생명별 분석",
  student: "대학생별 분석",
  manager: "관리자 팀 분석",
  overall: "전체 분석",
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  life: "개별 생명의 상태, 반응 동향, 성격 파악, 다음 단계 제안",
  student: "대학생의 전도 스타일, 장단점, 페일 패턴 분석",
  manager: "관리자 팀의 현황, 팀워크, 병목 구간 분석",
  overall: "전체 조직의 성과, 병목, 전략적 개선 제안",
};

const TYPE_COLORS: Record<string, string> = {
  life: "border-blue-300 bg-blue-50",
  student: "border-indigo-300 bg-indigo-50",
  manager: "border-purple-300 bg-purple-50",
  overall: "border-green-300 bg-green-50",
};

export default function AnalysisPage() {
  const [tab, setTab] = useState<"new" | "history">("new");
  const [selectedType, setSelectedType] = useState("");
  const [targets, setTargets] = useState<SelectOption[]>([]);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [currentReport, setCurrentReport] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (selectedType && selectedType !== "overall") fetchTargets();
  }, [selectedType]);

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

    setAnalyzing(true);
    setError("");
    setCurrentReport(null);

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
        setError(data.error || "분석에 실패했습니다.");
      } else {
        setCurrentReport(data.content);
        fetchReports();
      }
    } catch {
      setError("서버 연결에 실패했습니다.");
    }

    setAnalyzing(false);
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
          onClick={() => { setTab("history"); setCurrentReport(null); }}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            tab === "history" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          보고서 이력 ({reports.length})
        </button>
      </div>

      {/* 새 분석 */}
      {tab === "new" && !currentReport && (
        <div className="space-y-3">
          {/* 유형 선택 */}
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setSelectedType(key); setCurrentReport(null); setError(""); }}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  selectedType === key
                    ? TYPE_COLORS[key] + " border-current"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm font-bold">{label}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{TYPE_DESCRIPTIONS[key]}</p>
              </button>
            ))}
          </div>

          {/* 대상 선택 */}
          {selectedType && selectedType !== "overall" && (
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
            >
              <option value="">
                {selectedType === "life" ? "생명 선택" : selectedType === "student" ? "대학생 선택" : "관리자 선택"}
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
            disabled={!canAnalyze || analyzing}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {analyzing ? "분석 중... (30초~1분 소요)" : "분석 시작"}
          </button>
        </div>
      )}

      {/* 분석 중 */}
      {analyzing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="animate-pulse text-blue-600 font-medium">Gemini가 분석 중입니다...</div>
          <p className="text-xs text-blue-400 mt-2">데이터를 수집하고 보고서를 생성하고 있습니다</p>
        </div>
      )}

      {/* 현재 보고서 표시 */}
      {currentReport && tab === "new" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700">분석 보고서</h3>
            <button
              onClick={() => setCurrentReport(null)}
              className="text-xs text-blue-500"
            >
              새 분석
            </button>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(currentReport) }}
          />
        </div>
      )}

      {/* 보고서 이력 */}
      {tab === "history" && !viewingReport && (
        <div className="space-y-2">
          {reports.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">저장된 보고서가 없습니다.</p>
          )}
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setViewingReport(r)}
              className="w-full bg-white rounded-lg border border-gray-200 p-3 text-left hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    r.type === "life" ? "bg-blue-100 text-blue-700" :
                    r.type === "student" ? "bg-indigo-100 text-indigo-700" :
                    r.type === "manager" ? "bg-purple-100 text-purple-700" :
                    "bg-green-100 text-green-700"
                  }`}>
                    {TYPE_LABELS[r.type]}
                  </span>
                  <span className="text-sm font-medium">{r.target_name}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(r.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.content.slice(0, 100)}...</p>
            </button>
          ))}
        </div>
      )}

      {/* 보고서 상세 보기 */}
      {viewingReport && tab === "history" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                viewingReport.type === "life" ? "bg-blue-100 text-blue-700" :
                viewingReport.type === "student" ? "bg-indigo-100 text-indigo-700" :
                viewingReport.type === "manager" ? "bg-purple-100 text-purple-700" :
                "bg-green-100 text-green-700"
              }`}>
                {TYPE_LABELS[viewingReport.type]}
              </span>
              <span className="text-sm font-bold ml-2">{viewingReport.target_name}</span>
              <span className="text-xs text-gray-400 ml-2">
                {new Date(viewingReport.created_at).toLocaleDateString("ko-KR")}
              </span>
            </div>
            <button onClick={() => setViewingReport(null)} className="text-xs text-gray-500">← 목록</button>
          </div>
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(viewingReport.content) }}
          />
        </div>
      )}
    </div>
  );
}

// 간단한 마크다운 → HTML 변환
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
