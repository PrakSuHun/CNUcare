"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { STAGE_LABELS } from "@/lib/stages";

interface Life {
  id: string;
  name: string;
  stage: string;
}

interface LessonReaction {
  lesson_number: number;
  lesson_name: string;
  lesson_level: string;
  attended_date: string | null;
  instructor_name: string | null;
  is_passed: boolean;
  note: string | null;
  journal_response: string | null;
  journal_date: string | null;
}

interface Report {
  id: string;
  type: string;
  target_name: string;
  content: string;
  status: string;
  created_at: string;
}

const LEVEL_LABELS: Record<string, string> = {
  intro: "입문", beginner: "초급", intermediate: "중급", advanced: "고급",
};

export default function InstructorAnalysis() {
  const [tab, setTab] = useState<"life" | "lecture">("life");
  const [lives, setLives] = useState<Life[]>([]);
  const [selectedLife, setSelectedLife] = useState("");
  const [selectedLectureLife, setSelectedLectureLife] = useState("");
  const [lifeSearch, setLifeSearch] = useState("");
  const [lectureSearch, setLectureSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [reactions, setReactions] = useState<LessonReaction[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyLives();
    fetchReports();
    fetch("/api/process-reports").catch(() => {});
  }, []);

  // 주기적 갱신
  useEffect(() => {
    const hasPending = reports.some((r) => r.status === "pending" || r.status === "processing");
    if (!hasPending) return;
    const interval = setInterval(() => {
      fetchReports();
      fetch("/api/process-reports").catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [reports]);

  const fetchMyLives = async () => {
    const user = getUser();
    if (!user) return;
    const { data } = await supabase
      .from("user_lives")
      .select("life_id, lives(id, name, stage)")
      .eq("user_id", user.id);
    if (data) {
      setLives(data.map((ul: any) => ul.lives as Life).filter((l: any) => l && !l.is_failed));
    }
  };

  const fetchReports = async () => {
    const user = getUser();
    if (!user) return;
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setReports(data);
  };

  // 생명 분석 요청
  const handleAnalyze = async () => {
    if (!selectedLife) return;
    const user = getUser();
    if (!user) return;
    setSubmitting(true);
    setError("");

    const life = lives.find((l) => l.id === selectedLife);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "life",
          targetId: selectedLife,
          targetName: life?.name || "",
          createdBy: user.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "분석 요청 실패");
      else { fetchReports(); setSelectedLife(""); }
    } catch {
      setError("서버 연결 실패");
    }
    setSubmitting(false);
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm("이 보고서를 삭제하시겠습니까?")) return;
    await supabase.from("reports").delete().eq("id", reportId);
    setViewingReport(null);
    fetchReports();
  };

  // 강의 반응 정리
  const fetchLectureReactions = async (lifeId: string) => {
    setLoadingReactions(true);
    setSelectedLectureLife(lifeId);

    // 강의 체크 + 강의 정보
    const { data: checks } = await supabase
      .from("lesson_checks")
      .select("*, lesson:lessons(number, name, level)")
      .eq("life_id", lifeId)
      .order("created_at");

    // 강의 목적 일지
    const { data: journals } = await supabase
      .from("journals")
      .select("lesson_id, met_date, response")
      .eq("life_id", lifeId)
      .eq("purpose", "lecture")
      .is("deleted_at", null)
      .order("met_date");

    const journalMap = new Map<string, { response: string; date: string }>();
    journals?.forEach((j: any) => {
      if (j.lesson_id) {
        journalMap.set(j.lesson_id, { response: j.response, date: j.met_date });
      }
    });

    const result: LessonReaction[] = (checks || []).map((c: any) => ({
      lesson_number: c.lesson?.number || 0,
      lesson_name: c.lesson?.name || "",
      lesson_level: c.lesson?.level || "",
      attended_date: c.attended_date,
      instructor_name: c.instructor_name || null,
      is_passed: c.is_passed,
      note: c.note,
      journal_response: journalMap.get(c.lesson_id)?.response || null,
      journal_date: journalMap.get(c.lesson_id)?.date || null,
    }));

    result.sort((a, b) => a.lesson_number - b.lesson_number);
    setReactions(result);
    setLoadingReactions(false);
  };

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
        <button
          onClick={() => { setTab("life"); setReactions([]); setSelectedLectureLife(""); setViewingReport(null); }}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            tab === "life" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          생명 분석
        </button>
        <button
          onClick={() => { setTab("lecture"); setViewingReport(null); }}
          className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
            tab === "lecture" ? "bg-blue-600 text-white" : "text-gray-500"
          }`}
        >
          강의 반응 정리
        </button>
      </div>

      {/* 생명 분석 */}
      {tab === "life" && !viewingReport && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="이름으로 검색"
            value={lifeSearch}
            onChange={(e) => setLifeSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={selectedLife}
            onChange={(e) => setSelectedLife(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="">생명 선택</option>
            {lives
              .filter((l) => !lifeSearch || l.name.toLowerCase().includes(lifeSearch.toLowerCase()))
              .map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({STAGE_LABELS[l.stage] || l.stage})</option>
              ))}
          </select>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={!selectedLife || submitting}
            className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "요청 중..." : "분석 시작"}
          </button>

          {/* 보고서 이력 */}
          {reports.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs text-gray-500">보고서 이력</p>
              {reports.map((r) => {
                const isPending = r.status === "pending" || r.status === "processing";
                return (
                  <div key={r.id} className={`rounded-lg border p-3 ${
                    isPending ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                  }`}>
                    <div className="flex items-start justify-between">
                      <button
                        onClick={() => !isPending && setViewingReport(r)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{r.target_name}</span>
                          {isPending && <span className="text-[10px] bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full animate-pulse">분석 중</span>}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                        <button onClick={() => handleDeleteReport(r.id)} className="text-xs text-gray-300 hover:text-red-400">삭제</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 보고서 상세 */}
      {viewingReport && tab === "life" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">{viewingReport.target_name} 분석</span>
            <div className="flex items-center gap-2">
              <button onClick={() => handleDeleteReport(viewingReport.id)} className="text-xs text-red-400 border border-red-200 rounded-full px-3 py-1 hover:bg-red-50">삭제</button>
              <button onClick={() => setViewingReport(null)} className="text-xs text-gray-500">← 목록</button>
            </div>
          </div>
          <div dangerouslySetInnerHTML={{ __html: extractHtml(viewingReport.content) }} />
        </div>
      )}

      {/* 강의 반응 정리 */}
      {tab === "lecture" && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="이름으로 검색"
            value={lectureSearch}
            onChange={(e) => setLectureSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={selectedLectureLife}
            onChange={(e) => { if (e.target.value) fetchLectureReactions(e.target.value); else { setSelectedLectureLife(""); setReactions([]); } }}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
          >
            <option value="">생명 선택</option>
            {lives
              .filter((l) => !lectureSearch || l.name.toLowerCase().includes(lectureSearch.toLowerCase()))
              .map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({STAGE_LABELS[l.stage] || l.stage})</option>
              ))}
          </select>

          {loadingReactions && <p className="text-center text-sm text-gray-400 py-4">로딩 중...</p>}

          {!loadingReactions && selectedLectureLife && reactions.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">수강 기록이 없습니다.</p>
          )}

          {reactions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">수강 강의 {reactions.length}개</p>
              {reactions.map((r, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
                  {/* 강의명 + 레벨 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold">{r.lesson_number}. {r.lesson_name}</span>
                      {r.is_passed && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">패스</span>}
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{LEVEL_LABELS[r.lesson_level] || r.lesson_level}</span>
                  </div>

                  {/* 수강일 + 강의자 */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    {r.attended_date && <span>{r.attended_date}</span>}
                    {r.instructor_name && (
                      <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">강사: {r.instructor_name}</span>
                    )}
                  </div>

                  {/* 생명 반응 (진도표 비고 + 일지 반응 통합) */}
                  {(r.note || r.journal_response) ? (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-[10px] text-gray-400 mb-1 font-medium">생명 반응</p>
                      {r.note && (
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.note}</p>
                      )}
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
    </div>
  );
}

function extractHtml(content: string): string {
  const codeBlockMatch = content.match(/```html\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();
  const divMatch = content.match(/<div[\s\S]*<\/div>/);
  if (divMatch) return divMatch[0];
  return content.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}
