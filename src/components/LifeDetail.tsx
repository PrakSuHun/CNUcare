"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser, User } from "@/lib/auth";
import LessonProgress from "@/components/LessonProgress";
import Appointments from "@/components/Appointments";

interface Life {
  id: string;
  name: string;
  student_id_number: string | null;
  age: number | null;
  grade: string | null;
  department: string | null;
  mbti: string | null;
  meeting_reason: string | null;
  meeting_count: number;
  has_partner: boolean | null;
  characteristics: string | null;
  birth_year: string | null;
  stage: string;
  is_failed: boolean;
}

interface Journal {
  id: string;
  met_date: string;
  location: string;
  response: string;
  author_id: string;
  created_at: string;
  purpose?: string;
  instructor_name?: string;
  author?: { display_name: string };
}

import { STAGE_LABELS, STAGE_OPTIONS } from "@/lib/stages";

interface LifeDetailProps {
  lifeId: string;
  basePath: string;
  backPath: string;
  readOnly?: boolean;
}

export default function LifeDetail({ lifeId, basePath, backPath, readOnly = false }: LifeDetailProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [life, setLife] = useState<Life | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInfo, setEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Life>>({});
  const [activeTab, setActiveTab] = useState<"info" | "lessons" | "appointments">("info");
  const [showMenu, setShowMenu] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [deletedJournals, setDeletedJournals] = useState<Journal[]>([]);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push("/");
      return;
    }
    setUser(u);
    fetchData();
    // 밀린 큐 처리
    fetch("/api/process-queue").catch(() => {});
  }, [router, lifeId]);

  const fetchData = async () => {
    const [lifeRes, journalRes] = await Promise.all([
      supabase.from("lives").select("*").eq("id", lifeId).single(),
      supabase
        .from("journals")
        .select("*, author:users(display_name), read_by")
        .eq("life_id", lifeId)
        .is("deleted_at", null)
        .order("met_date", { ascending: false }),
    ]);

    if (lifeRes.data) {
      setLife(lifeRes.data);
      setEditForm(lifeRes.data);
    }
    if (journalRes.data) {
      setJournals(journalRes.data as any);
      // 읽음 처리: 현재 사용자를 read_by에 추가
      const currentUser = getUser();
      if (currentUser) {
        const unread = journalRes.data.filter((j: any) => !(j.read_by || []).includes(currentUser.id));
        for (const j of unread) {
          supabase.from("journals").update({ read_by: [...(j.read_by || []), currentUser.id] }).eq("id", j.id).then(() => {});
        }
      }
    }
    setLoading(false);
  };

  const handleSaveInfo = async () => {
    await supabase
      .from("lives")
      .update({
        student_id_number: editForm.student_id_number || null,
        age: editForm.age || null,
        grade: editForm.grade || null,
        department: editForm.department || null,
        mbti: editForm.mbti || null,
        meeting_reason: editForm.meeting_reason || null,
        has_partner: editForm.has_partner,
        characteristics: editForm.characteristics || null,
        birth_year: editForm.birth_year || null,
      })
      .eq("id", lifeId);
    setEditingInfo(false);
    fetchData();
  };

  const handleStageChange = async (newStage: string) => {
    await supabase.from("lives").update({ stage: newStage }).eq("id", lifeId);
    fetchData();
  };

  const handleFail = async () => {
    if (!confirm("이 생명을 페일 처리하시겠습니까?")) return;
    await supabase.from("lives").update({ is_failed: true }).eq("id", lifeId);
    router.push(backPath);
  };

  const fetchDeletedJournals = async () => {
    const { data } = await supabase
      .from("journals")
      .select("*, author:users(display_name)")
      .eq("life_id", lifeId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (data) setDeletedJournals(data as any);
  };

  const handleRestoreJournal = async (journalId: string) => {
    await supabase.from("journals").update({ deleted_at: null }).eq("id", journalId);
    fetchData();
    fetchDeletedJournals();
  };

  const handlePermanentDelete = async (journalId: string) => {
    if (!confirm("영구 삭제하시겠습니까? 복원할 수 없습니다.")) return;
    await supabase.from("journals").delete().eq("id", journalId);
    fetchDeletedJournals();
  };

  const handleDeleteJournal = async (journalId: string) => {
    if (!confirm("이 일지를 삭제하시겠습니까? (30일간 휴지통에 보관됩니다)")) return;
    await supabase.from("journals").update({ deleted_at: new Date().toISOString() }).eq("id", journalId);
    fetchData();
    fetchDeletedJournals();
  };

  const handleRestore = async () => {
    await supabase.from("lives").update({ is_failed: false }).eq("id", lifeId);
    fetchData();
  };

  if (loading || !life) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center">
          <button onClick={() => router.push(backPath)} className="text-gray-500 mr-3">&larr;</button>
          <div>
            <h1 className="text-lg font-bold">{life.name}</h1>
            <p className="text-xs text-gray-500">
              {STAGE_LABELS[life.stage] || life.stage}
              {life.is_failed && " (페일)"}
            </p>
          </div>
        </div>
        {!readOnly && <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
          >
            <span className="text-lg leading-none">⋯</span>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40">
                <button
                  onClick={() => { setShowMenu(false); setShowTrash(true); fetchDeletedJournals(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  휴지통
                </button>
                {life.is_failed ? (
                  <button
                    onClick={() => { setShowMenu(false); handleRestore(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50"
                  >
                    생명 복구
                  </button>
                ) : (
                  <button
                    onClick={() => { setShowMenu(false); handleFail(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                  >
                    페일 처리
                  </button>
                )}
              </div>
            </>
          )}
        </div>}
      </header>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === "info" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          정보 · 일지
        </button>
        <button
          onClick={() => setActiveTab("appointments")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === "appointments" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          약속
        </button>
        <button
          onClick={() => setActiveTab("lessons")}
          className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === "lessons" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
          }`}
        >
          강의 진도표
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
      {/* 강의 진도표 탭 */}
      {activeTab === "lessons" && (
        <div className="p-4">
          <LessonProgress lifeId={lifeId} />
        </div>
      )}

      {/* 약속 탭 */}
      {activeTab === "appointments" && (
        <div className="p-4">
          <Appointments lifeId={lifeId} readOnly={readOnly} />
        </div>
      )}

      {/* 정보 · 일지 탭 */}
      {activeTab === "info" && (
      <div className="p-4 space-y-4">
        {!life.is_failed && !readOnly && life.stage !== "completed" && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">현재 단계</p>
                <p className="text-sm font-medium">{STAGE_LABELS[life.stage] || life.stage}</p>
              </div>
              <button
                onClick={() => {
                  const dateInput = prompt("수료일을 입력해주세요 (예: 2026-04-15)");
                  if (!dateInput) return;
                  supabase.from("lives").update({ stage: "completed", completed_at: dateInput }).eq("id", lifeId).then(() => fetchData());
                }}
                className="text-xs px-4 py-2 rounded-full border border-green-400 text-green-600 hover:bg-green-50 transition-colors"
              >
                수료 처리
              </button>
            </div>
          </div>
        )}
        {life.stage === "completed" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm font-medium text-green-700">수료 완료</p>
            {(life as any).completed_at && <p className="text-xs text-green-500 mt-1">수료일: {(life as any).completed_at}</p>}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">기본 정보</p>
            {!readOnly && <button
              onClick={() => { if (editingInfo) handleSaveInfo(); else setEditingInfo(true); }}
              className="text-xs text-blue-500"
            >
              {editingInfo ? "저장" : "수정"}
            </button>}
          </div>
          {editingInfo ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="학번(나이)" value={editForm.student_id_number || ""} onChange={(e) => setEditForm((f) => ({ ...f, student_id_number: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" />
                <input type="number" placeholder="나이" value={editForm.age || ""} onChange={(e) => setEditForm((f) => ({ ...f, age: parseInt(e.target.value) || null }))} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="학년" value={editForm.grade || ""} onChange={(e) => setEditForm((f) => ({ ...f, grade: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" />
                <input placeholder="학과" value={editForm.department || ""} onChange={(e) => setEditForm((f) => ({ ...f, department: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="MBTI" value={editForm.mbti || ""} onChange={(e) => setEditForm((f) => ({ ...f, mbti: e.target.value }))} className="rounded border border-gray-300 px-3 py-2 text-sm" />
                <input placeholder="생년 뒤 2자리" value={editForm.birth_year || ""} onChange={(e) => setEditForm((f) => ({ ...f, birth_year: e.target.value }))} maxLength={2} className="rounded border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <input placeholder="만남 경위" value={editForm.meeting_reason || ""} onChange={(e) => setEditForm((f) => ({ ...f, meeting_reason: e.target.value }))} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
              <textarea placeholder="특징" value={editForm.characteristics || ""} onChange={(e) => setEditForm((f) => ({ ...f, characteristics: e.target.value }))} rows={2} className="w-full rounded border border-gray-300 px-3 py-2 text-sm resize-none" />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              {life.student_id_number && <InfoRow label="학번" value={life.student_id_number} />}
              {life.age && <InfoRow label="나이" value={`${life.age}세`} />}
              {life.grade && <InfoRow label="학년" value={life.grade} />}
              {life.department && <InfoRow label="학과" value={life.department} />}
              {life.mbti && <InfoRow label="MBTI" value={life.mbti} />}
              {life.meeting_reason && <InfoRow label="만남 경위" value={life.meeting_reason} />}
              {life.has_partner !== null && <InfoRow label="이성 유무" value={life.has_partner ? "있음" : "없음"} />}
              {life.characteristics && <InfoRow label="특징" value={life.characteristics} />}
              {!life.student_id_number && !life.age && !life.department && !life.mbti && (
                <p className="text-gray-400 text-xs">기본 정보가 아직 없습니다.</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-700">일지 ({journals.length})</p>
            {!readOnly && <button onClick={() => router.push(`${basePath}/life/${lifeId}/journal/new`)} className="text-xs text-blue-500">+ 일지 추가</button>}
          </div>
          {journals.length === 0 ? (
            <p className="text-xs text-gray-400">작성된 일지가 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {journals.map((j) => {
                const isConverting = j.response === "(텍스트 변환 중입니다)";
                return (
                  <div key={j.id} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <button
                        onClick={() => router.push(`${basePath}/life/${lifeId}/journal/${j.id}`)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{new Date(j.met_date).toLocaleDateString("ko-KR")}</span>
                          <span className="text-xs text-gray-400">{(j.author as any)?.display_name || ""}</span>
                          {isConverting && (
                            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full animate-pulse">변환 중</span>
                          )}
                        </div>
                        {j.purpose && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {j.purpose === "first_meeting" ? "1차 만남" : j.purpose === "pre_visit" ? "전초" : j.purpose === "management" ? "관리" : j.purpose === "lecture" ? `강의${j.instructor_name ? `(${j.instructor_name})` : ""}` : j.purpose}
                          </p>
                        )}
                        {isConverting ? (
                          <p className="text-sm text-blue-500 mt-1 italic">텍스트 변환 중입니다...</p>
                        ) : (
                          <p className="text-sm text-gray-800 mt-1 line-clamp-2">{j.response}</p>
                        )}
                      </button>
                      {!readOnly && <button
                        onClick={() => handleDeleteJournal(j.id)}
                        className="text-xs text-gray-300 hover:text-red-400 ml-2 mt-1 shrink-0"
                      >
                        삭제
                      </button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
      </div>

      {/* 휴지통 모달 */}
      {showTrash && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowTrash(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">휴지통 (30일 보관)</h3>
              <button onClick={() => setShowTrash(false)} className="text-xs text-gray-400">닫기</button>
            </div>
            {deletedJournals.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-8">삭제된 일지가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {deletedJournals.map((j) => (
                  <div key={j.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-gray-500">{new Date(j.met_date).toLocaleDateString("ko-KR")}</span>
                        <span className="text-xs text-gray-400 ml-2">{(j.author as any)?.display_name || ""}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleRestoreJournal(j.id)}
                          className="text-xs text-blue-500 border border-blue-300 rounded-full px-2.5 py-1 hover:bg-blue-50"
                        >
                          복원
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(j.id)}
                          className="text-xs text-red-400 border border-red-200 rounded-full px-2.5 py-1 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{j.location}</p>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-3">{j.response}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
