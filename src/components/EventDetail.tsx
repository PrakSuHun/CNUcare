"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { parseFiles } from "@/lib/parseUpload";
import { formatPhone } from "@/lib/phone";
import { convertAttendeeToLife } from "@/lib/convertLife";
import * as XLSX from "xlsx";

// AI 보고서 content → 렌더용 HTML (코드펜스/마크다운 대응). 다른 분석 화면과 동일 규칙.
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

// 한글(IME) 입력 안정화: 입력 중엔 로컬 상태만 갱신하고, 포커스 아웃 때 커밋.
// (키 입력마다 부모 리렌더/DB저장하면 iOS에서 한글 조합이 깨짐)
function InlineTextarea({ value, onCommit, className, placeholder, rows }: {
  value: string; onCommit: (v: string) => void; className?: string; placeholder?: string; rows?: number;
}) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(value); }, [value]);
  return (
    <textarea value={local} placeholder={placeholder} rows={rows} className={className}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { focused.current = false; if (local !== value) onCommit(local); }} />
  );
}
function InlineInput({ value, onCommit, className, placeholder }: {
  value: string; onCommit: (v: string) => void; className?: string; placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(value); }, [value]);
  return (
    <input type="text" value={local} placeholder={placeholder} className={className}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => { focused.current = false; if (local !== value) onCommit(local); }} />
  );
}

const YEAR_LABELS: Record<number, string> = { 1: "1학년", 2: "2학년", 3: "3학년", 4: "4학년", 0: "졸업유예" };
const formatYear = (y: number | null) => y != null ? YEAR_LABELS[y] || `${y}` : "";

// 외부 공유용 URL의 도메인. NEXT_PUBLIC_PUBLIC_BASE_URL이 설정돼 있으면 그 값,
// 없으면 현재 접속 도메인. (내부용/외부용 도메인을 분리 운영 시 외부 도메인으로 설정)
const publicBase = () => process.env.NEXT_PUBLIC_PUBLIC_BASE_URL || (typeof window !== "undefined" ? window.location.origin : "");

interface EventDetailProps {
  eventId: string;
  basePath: string;
}

interface Event {
  id: string;
  name: string;
  type: "onetime" | "club";
  club_unit?: "daily" | "weekly";
  slug?: string;
  created_by: string;
  poster_url?: string | null;
  created_at?: string;
}

// 브라우저에서 이미지 리사이즈 (가로 max 1200px, JPEG 0.85)
async function resizeImage(file: File, maxWidth = 1200, quality = 0.85): Promise<Blob> {
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = document.createElement("img");
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => b ? res(b) : rej(new Error("리사이즈 실패")), "image/jpeg", quality)
  );
}

interface Attendee {
  id: string;
  name: string;
  gender: string | null;
  school: string | null;
  department: string | null;
  year: number | null;
  phone: string | null;
  team: string | null;
  manager_id: string | null;
  friend_group: string | null;
  status: string | null;
  memo: string | null;
  assessment: string | null;
  is_member: boolean;
  life_id: string | null;
  opposite_sex: boolean | null;
  payment_status: string | null; // null=미입금, "입금", "환불"
  custom_data: Record<string, string> | null;
  created_at: string | null;
}

// 현황 막대그래프 대상 필드 (학년·성별·신청폼 선택형)
type ChartField = { key: string; label: string; kind: "year" | "gender" | "custom"; split?: boolean };

interface Member {
  id: string;
  user_id: string;
  display_name: string;
}

interface AttendanceRecord {
  id: string;
  attendee_id: string;
  date: string;
  present: boolean;
  check_group: string | null;
}

interface Feedback {
  id: string;
  content: string;
  type: "life" | "member";
  author_id: string | null;
  created_at: string;
}

type Tab = "attendance" | "detail" | "status" | "settings";
type SortOption = "name" | "year" | "recent";
type GroupOption = string; // "default" | "team" | "manager" | "lifeOnly" | "attendance" | "friend" | "custom_xxx"

export default function EventDetail({ eventId, basePath }: EventDetailProps) {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);

  const handlePosterUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !event) return;
    setPosterUploading(true);
    try {
      const blob = await resizeImage(f);
      const path = `${eventId}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("event-posters").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const publicUrl = supabase.storage.from("event-posters").getPublicUrl(path).data.publicUrl;
      const oldPath = event.poster_url?.split("/event-posters/")[1];
      if (oldPath && oldPath !== path) await supabase.storage.from("event-posters").remove([oldPath]).catch(() => {});
      const { error: dbErr } = await supabase.from("events").update({ poster_url: publicUrl }).eq("id", eventId);
      if (dbErr) throw dbErr;
      setEvent({ ...event, poster_url: publicUrl });
    } catch (err: any) {
      alert("업로드 실패: " + (err?.message || "알 수 없는 오류"));
    } finally {
      setPosterUploading(false);
      e.target.value = "";
    }
  };

  const handlePosterDelete = async () => {
    if (!event?.poster_url) return;
    if (!confirm("포스터를 삭제할까요?")) return;
    const path = event.poster_url.split("/event-posters/")[1];
    if (path) await supabase.storage.from("event-posters").remove([path]).catch(() => {});
    await supabase.from("events").update({ poster_url: null }).eq("id", eventId);
    setEvent({ ...event, poster_url: null });
  };
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("attendance");

  // Attendance tab state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [groupBy, setGroupBy] = useState<GroupOption>("default");
  const [lifeOnly, setLifeOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<"guest" | "member">("guest");
  const [memberSearch, setMemberSearch] = useState("");
  const [allUsers, setAllUsers] = useState<{ id: string; display_name: string }[]>([]);
  const [newAttendeeName, setNewAttendeeName] = useState("");
  const [newAttendeeGender, setNewAttendeeGender] = useState("");
  const [newAttendeeSchool, setNewAttendeeSchool] = useState("");
  const [newAttendeeDept, setNewAttendeeDept] = useState("");
  const [newAttendeeYear, setNewAttendeeYear] = useState("");
  const [newAttendeePhone, setNewAttendeePhone] = useState("");
  const [newAttendeeFriend, setNewAttendeeFriend] = useState("");
  const [showRateModal, setShowRateModal] = useState(false);

  // Club period state
  const [clubWeek, setClubWeek] = useState(1);

  // Detail tab state
  const [detailMode, setDetailMode] = useState<"before" | "after">("before");
  const [detailSearch, setDetailSearch] = useState(""); // 상세 탭 사람 검색
  const [expandedAttendee, setExpandedAttendee] = useState<string | null>(null);
  const [editingAttendee, setEditingAttendee] = useState<string | null>(null);

  // Status tab state
  const [chartPopup, setChartPopup] = useState<{ field: ChartField; value: string } | null>(null); // 그래프 막대 클릭 → 명단 팝업
  // 명단 미리보기 모달 (엑셀 다운/구글시트 복사)
  const [roster, setRoster] = useState<{ title: string; fileName: string; cols: string[]; sections: { name: string; rows: Record<string, string>[] }[]; total: number; tsv: string; xlsxUrl: string; multi: boolean } | null>(null);
  const [rosterCopied, setRosterCopied] = useState(false);
  const [feedbackTab, setFeedbackTab] = useState<"life" | "member">("life");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  // 관리자 피드백 페이지에서 쓴 애로사항·건의 (event_feedback_requests.note)
  const [feedbackNotes, setFeedbackNotes] = useState<{ id: string; name: string; note: string; submitted_at: string | null }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  // 행사 AI 분석 — 백그라운드(reports)로 실행, 버튼 상태로 반영
  const [eventReport, setEventReport] = useState<{ id: string; status: string; content: string } | null>(null);
  const [aiCustomOpen, setAiCustomOpen] = useState(false);
  const [aiCustomText, setAiCustomText] = useState("");
  const [feedbackReqSending, setFeedbackReqSending] = useState(false);
  const aiPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Feedback form generation
  const [showFeedbackGen, setShowFeedbackGen] = useState(false);
  const [fbAnonymous, setFbAnonymous] = useState(false);
  const [fbQuestions, setFbQuestions] = useState(["좋았던 점", "아쉬웠던 점"]);
  const [fbNewQ, setFbNewQ] = useState("");
  const [fbUrl, setFbUrl] = useState("");
  const [fbFormId, setFbFormId] = useState<string | null>(null); // 기존 피드백 폼 id (수정/삭제용)
  const [feedbackResponses, setFeedbackResponses] = useState<any[]>([]);

  // Form URLs
  const [regFormUrl, setRegFormUrl] = useState("");
  const [checkinFormUrl, setCheckinFormUrl] = useState("");
  const [showRegGen, setShowRegGen] = useState(false);
  const [showCheckinGen, setShowCheckinGen] = useState(false);
  const defaultRegFields = [
    { id: "name", label: "이름", type: "text" as const, required: true, builtin: true },
    { id: "school", label: "학교", type: "dropdown" as const, required: false, options: ["충남대학교", "한밭대학교", "한남대학교", "대전대학교", "우송대학교", "배재대학교", "목원대학교"], builtin: true },
    { id: "department", label: "학과", type: "text" as const, required: false, builtin: true },
    { id: "year", label: "학년", type: "dropdown" as const, required: false, options: ["1학년", "2학년", "3학년", "4학년", "졸업유예"], builtin: true },
    { id: "gender", label: "성별", type: "dropdown" as const, required: false, options: ["남", "여"], builtin: true },
    { id: "custom_birth", label: "생년월일", type: "text" as const, required: false, description: "예: 2000.01.01" },
    { id: "phone", label: "연락처", type: "text" as const, required: false, builtin: true },
    { id: "friend_group", label: "같이 오시는 분 성함", type: "text" as const, required: false, builtin: true },
    { id: "custom_inflow_event", label: "유입된 행사", type: "text" as const, required: false },
    { id: "custom_feedback_score", label: "피드백 점수", type: "dropdown" as const, required: false, options: ["1", "2", "3", "4", "5"] },
    { id: "custom_feedback_text", label: "피드백 내용", type: "textarea" as const, required: false },
  ];
  const [regFields, setRegFields] = useState<{ id: string; label: string; type: "text" | "textarea" | "dropdown" | "checkbox"; required: boolean; options?: string[]; description?: string; builtin?: boolean }[]>([]);
  const [regNewLabel, setRegNewLabel] = useState("");
  const [regNewType, setRegNewType] = useState<"text" | "textarea" | "dropdown" | "checkbox">("text");
  const [regNewOptions, setRegNewOptions] = useState("");
  const [regNewDescription, setRegNewDescription] = useState("");
  const [regPreview, setRegPreview] = useState(false);
  const [regDescription, setRegDescription] = useState("");
  const [checkinType, setCheckinType] = useState<"individual" | "team">("individual");
  const [checkinPopupText, setCheckinPopupText] = useState("");
  const [checkinShowFields, setCheckinShowFields] = useState<string[]>([]);

  // Excel upload
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelPreview, setExcelPreview] = useState<Record<string, string>[]>([]);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelMapping, setExcelMapping] = useState<Record<string, string>>({});
  const [excelUploading, setExcelUploading] = useState(false);
  const [rosterUploading, setRosterUploading] = useState(false); // 이미지·엑셀 파일로 참석자 추가

  // Sessions (동아리 회차)
  const [sessions, setSessions] = useState<{ number: number; date: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("all"); // "all" or session date

  // 행사 설정 config 전체(세션 저장 시 다른 키 보존용) + 내 알림 수신 여부
  const [settingsConfig, setSettingsConfig] = useState<Record<string, any>>({});
  const [notifyOptOut, setNotifyOptOut] = useState(false); // 이 행사 신청 알림 안 받기

  // 중복 의심자 배너 (다른 행사·프로젠·생명과 이름이 겹치는 참여자). 확인 누르면 사라짐(설정에 저장).
  type DupSuspect = {
    attendeeId: string; name: string; summary: string; isLife: boolean; lifeManager: string | null;
    matchType?: "phone" | "name"; // phone=이름+번호 일치(확정 중복,빨강) / name=이름만(의심,주황)
    cnuEvents: { eventName: string; how: string; status: string | null }[];
    progenEvents: { event: string; kind: string; date: string | null }[];
  };
  const [dupSuspects, setDupSuspects] = useState<DupSuspect[]>([]);
  const [dupConfirming, setDupConfirming] = useState<string | null>(null);
  const [dupDetail, setDupDetail] = useState<DupSuspect | null>(null); // 상세 팝업 대상

  // 연결된 담당자 관리 (event_members에 CNUcare 사용자 추가)
  const [showConnectSearch, setShowConnectSearch] = useState(false);
  const [connectSearch, setConnectSearch] = useState("");

  // 학교별 명단 공유 + 전체 명단 공유
  const [schoolShares, setSchoolShares] = useState<{ id: string; school: string }[]>([]);
  const [allShare, setAllShare] = useState<{ id: string } | null>(null);
  const [showShareCreate, setShowShareCreate] = useState(false);
  const [shareCreateMode, setShareCreateMode] = useState<"view" | "all">("view");
  const [sharePwInput, setSharePwInput] = useState("");
  const SCHOOL_LIST = ["충남대학교", "한밭대학교", "한남대학교", "대전대학교", "우송대학교", "배재대학교", "목원대학교"];

  useEffect(() => {
    const u = getUser();
    if (!u) { router.push("/"); return; }
    fetchAll();
  }, [eventId]);

  const fetchAll = async () => {
    const [eventRes, attendeesRes, membersRes, attendanceRes, feedbackRes] = await Promise.all([
      supabase.from("events").select("*").eq("id", eventId).single(),
      supabase.from("event_attendees").select("*").eq("event_id", eventId).order("name"),
      supabase.from("event_members").select("id, user_id, users(display_name)").eq("event_id", eventId),
      supabase.from("event_attendance").select("*").eq("event_id", eventId),
      supabase.from("event_feedback").select("*").eq("event_id", eventId).order("created_at", { ascending: false }),
    ]);
    if (eventRes.data) {
      setEvent(eventRes.data);
      // 원회원 행사는 신청 당일 확인이 목적 → 기본 정렬을 최신순(신청일별 구분선)으로
      if (eventRes.data.name === "원회원") setSortBy("recent");
    }
    if (attendeesRes.data) setAttendees(attendeesRes.data as Attendee[]);
    if (membersRes.data) {
      setMembers(
        (membersRes.data as any[]).map((m) => ({
          id: m.id,
          user_id: m.user_id,
          display_name: (m.users as any)?.display_name || "알 수 없음",
        }))
      );
    }
    if (attendanceRes.data) setAttendanceRecords(attendanceRes.data as AttendanceRecord[]);
    if (feedbackRes.data) setFeedbacks(feedbackRes.data as Feedback[]);

    // 명단 공유 링크 로드 (학교별 view + 전체 all)
    const { data: shareData } = await supabase.from("event_share_links").select("id, school, mode").eq("event_id", eventId);
    if (shareData) {
      const arr = shareData as { id: string; school: string | null; mode: string }[];
      setSchoolShares(arr.filter((s) => s.mode === "view" && s.school).map((s) => ({ id: s.id, school: s.school as string })));
      const all = arr.find((s) => s.mode === "all");
      setAllShare(all ? { id: all.id } : null);
    }

    // 회차 설정 로드
    const { data: settingsForm } = await supabase.from("event_forms").select("config").eq("event_id", eventId).eq("type", "settings").limit(1);
    const loadedConfig = (settingsForm?.[0]?.config as Record<string, any>) || {};
    setSettingsConfig(loadedConfig);

    // 관리자 피드백 애로사항·건의(note) 로드 → 현황 탭에 표시
    const { data: reqData } = await supabase.from("event_feedback_requests")
      .select("id, note, submitted_at, manager_id").eq("event_id", eventId).not("note", "is", null);
    const notes = ((reqData || []) as { id: string; note: string; submitted_at: string | null; manager_id: string }[])
      .filter((r) => r.note && r.note.trim());
    if (notes.length) {
      const ids = [...new Set(notes.map((n) => n.manager_id))];
      const { data: us } = await supabase.from("users").select("id, display_name").in("id", ids);
      const nameOf = (id: string) => ((us || []) as { id: string; display_name: string }[]).find((u) => u.id === id)?.display_name || "관리자";
      setFeedbackNotes(notes.map((n) => ({ id: n.id, name: nameOf(n.manager_id), note: n.note, submitted_at: n.submitted_at })));
    } else {
      setFeedbackNotes([]);
    }

    // 중복 의심자 조회 (확인은 사람별 개별 — 내가 확인한 사람만 내 화면에서 제외)
    const myId = getUser()?.id || "";
    const confirmedByMe = (loadedConfig.dup_confirmed_by as Record<string, string[]> | undefined)?.[myId] || [];
    fetch(`/api/event-duplicates?event_id=${eventId}`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.suspects || []) as DupSuspect[];
        const shown = list
          .filter((s) => !confirmedByMe.includes(s.attendeeId))
          // 확정(번호까지 일치)을 위로
          .sort((a, b) => (a.matchType === "phone" ? 0 : 1) - (b.matchType === "phone" ? 0 : 1));
        setDupSuspects(shown);
        // 원회원 행사: 서버가 '웹 가입' 메모를 겹친 행사명으로 덮어씀 → 로컬 명단에 즉시 반영
        const memoUpdates = (d.memoUpdates || []) as { attendeeId: string; memo: string }[];
        if (memoUpdates.length) {
          setAttendees((prev) =>
            prev.map((a) => {
              const u = memoUpdates.find((x) => x.attendeeId === a.id);
              return u ? { ...a, memo: u.memo } : a;
            })
          );
        }
      })
      .catch(() => setDupSuspects([]));
    let loadedSessions = (loadedConfig.sessions as { number: number; date: string }[] | undefined) || [];
    // 세션이 없고 생성 시 넣은 event_date가 있으면 그걸 행사 날짜로 채움(설정 입력·접두 동기화)
    if (loadedSessions.length === 0 && eventRes.data?.event_date) {
      loadedSessions = [{ number: 1, date: eventRes.data.event_date }];
    }
    if (loadedSessions.length > 0) setSessions(loadedSessions);
    const optOut = (loadedConfig.notify_optout as string[] | undefined) || [];
    const meId = getUser()?.id;
    setNotifyOptOut(!!meId && optOut.includes(meId));

    // 출석일(selectedDate) 고정 규칙 — selectedDate가 기본값 "오늘"로 남으면
    // 날이 바뀔 때마다 체크가 다른 날짜에 저장/표시돼 "체크가 풀린 것처럼" 보임.
    const evData = eventRes.data;
    const isWeeklyClub = evData?.type === "club" && evData?.club_unit === "weekly";
    const isSingleOnetime = evData?.type === "onetime" && loadedSessions.length <= 1;
    if (isSingleOnetime) {
      // 일회성 단일 행사(회차 0~1개): 회차 UI 없이 단일 날짜로 고정.
      // 회차가 1개면 그 날짜, 없으면 생성일을 출석일로 사용.
      const singleDate = loadedSessions[0]?.date || evData?.created_at?.split("T")[0];
      if (singleDate) setSelectedDate(singleDate);
    } else if (loadedSessions.length > 0 && !isWeeklyClub) {
      // 회차를 여러 개 나눈 행사: 첫 회차를 기본 선택 → 출석일이 회차 날짜로 고정
      setSelectedSession(loadedSessions[0].date);
      setSelectedDate(loadedSessions[0].date);
    }

    // 기존 신청/출석 폼 URL 로드
    const ev = eventRes.data;
    const { data: existingForms } = await supabase.from("event_forms").select("id, type, config").eq("event_id", eventId);
    (existingForms || []).forEach((f: any) => {
      if (f.type === "registration") {
        setRegFormUrl(`${publicBase()}/register/${f.id}`);
        if (f.config?.fields) setRegFields(f.config.fields);
        if (typeof f.config?.description === "string") setRegDescription(f.config.description);
      }
      if (f.type === "checkin_individual") {
        setCheckinFormUrl(`${publicBase()}/checkin/${f.id}`);
        if (f.config?.popup_text) setCheckinPopupText(f.config.popup_text);
        if (f.config?.show_fields) setCheckinShowFields(f.config.show_fields);
        setCheckinType("individual");
      }
      if (f.type === "checkin_team") {
        setCheckinFormUrl(`${publicBase()}/check/${encodeURIComponent(ev?.slug || eventId)}`);
        setCheckinType("team");
      }
    });

    // 히든 피드백: 기존 폼이 있으면 URL 세팅 + 응답 조회
    const { data: forms } = await supabase.from("event_feedback_forms").select("id, is_anonymous, questions").eq("event_id", eventId).limit(1);
    if (forms && forms.length > 0) {
      const form = forms[0] as any;
      setFbUrl(`${publicBase()}/feedback/${form.id}`);
      setFbFormId(form.id);
      setFbAnonymous(form.is_anonymous);
      setFbQuestions(form.questions);
      const { data: responses } = await supabase.from("event_feedback_responses").select("*").eq("form_id", form.id).order("created_at", { ascending: false });
      if (responses) setFeedbackResponses(responses);
    }
    loadAllUsers(); // 담당 관리자 검색용 전체 CNUcare 사용자 미리 로드
    setLoading(false);
  };

  // 중복 의심자 "확인" — 사람별 개별 처리. 내 화면에서만 사라지고, 다른 담당자는 각자 확인해야 사라짐.
  // (dup_confirmed_by: { [userId]: attendeeId[] } — 확인한 본인 목록에만 추가)
  const confirmDup = async (attendeeId: string) => {
    const meId = getUser()?.id;
    if (!meId || dupConfirming) return;
    setDupConfirming(attendeeId);
    try {
      // 저장 직전 최신 config를 다시 읽어 병합 — 다른 담당자가 동시에 확인해도 서로의 기록이 덮이지 않게.
      const { data: existing } = await supabase.from("event_forms").select("id, config").eq("event_id", eventId).eq("type", "settings").limit(1);
      const base = (existing?.[0]?.config as Record<string, unknown> | undefined) || settingsConfig;
      const byUser: Record<string, string[]> = { ...((base.dup_confirmed_by as Record<string, string[]> | undefined) || {}) };
      byUser[meId] = Array.from(new Set([...(byUser[meId] || []), attendeeId]));
      const nextConfig = { ...base, dup_confirmed_by: byUser };
      if (existing && existing.length > 0) {
        await supabase.from("event_forms").update({ config: nextConfig }).eq("id", existing[0].id);
      } else {
        await supabase.from("event_forms").insert({ event_id: eventId, type: "settings", config: nextConfig, created_by: meId });
      }
      setSettingsConfig(nextConfig);
      setDupSuspects((prev) => prev.filter((s) => s.attendeeId !== attendeeId));
    } finally {
      setDupConfirming(null);
    }
  };

  // 공유 설정 config의 배열 필드에 값을 추가(스킵 처리 등). 담당자 공통 — 한 명이 처리하면 전원 반영.
  // 저장 직전 최신 config를 다시 읽어 병합해 동시 작업 시 유실 방지.
  const appendSharedConfigArray = async (field: string, value: string) => {
    const { data: existing } = await supabase.from("event_forms").select("id, config").eq("event_id", eventId).eq("type", "settings").limit(1);
    const base = (existing?.[0]?.config as Record<string, unknown> | undefined) || settingsConfig;
    const cur = (base[field] as string[] | undefined) || [];
    if (cur.includes(value)) return;
    const nextConfig = { ...base, [field]: [...cur, value] };
    if (existing && existing.length > 0) {
      await supabase.from("event_forms").update({ config: nextConfig }).eq("id", existing[0].id);
    } else {
      await supabase.from("event_forms").insert({ event_id: eventId, type: "settings", config: nextConfig, created_by: getUser()?.id });
    }
    setSettingsConfig(nextConfig);
  };

  // --- Attendance helpers ---
  // 주차별 날짜 범위 계산
  const getWeekDates = (weekKey: string): string[] => {
    if (!weekKey.startsWith("week_")) return [];
    const weekNum = parseInt(weekKey.replace("week_", ""));
    const dates = [...new Set(attendanceRecords.map(r => r.date))].sort();
    if (dates.length === 0) return [];
    const firstDate = new Date(dates[0]);
    const weekStart = new Date(firstDate.getTime() + (weekNum - 1) * 7 * 86400000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
    return dates.filter(d => d >= weekStart.toISOString().split("T")[0] && d <= weekEnd.toISOString().split("T")[0]);
  };

  const isPresentForView = (attendeeId: string): boolean => {
    if (selectedSession === "all") {
      return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.present);
    }
    if (selectedSession.startsWith("week_")) {
      const weekDates = getWeekDates(selectedSession);
      return attendanceRecords.some((r) => r.attendee_id === attendeeId && weekDates.includes(r.date) && r.present);
    }
    return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.date === selectedDate && r.present);
  };

  // 일회성 단일 행사: 출석링크가 '오늘' 날짜로 기록해도 화면 날짜와 안 맞아 체크가 안 보이던 문제 →
  // 날짜 무관하게 그 사람의 출석 기록으로 판정.
  const isSingleOnetimeNow = () => event?.type === "onetime" && sessions.length <= 1;
  const isPresent = (attendeeId: string, date: string) => {
    if (isSingleOnetimeNow()) return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.present === true);
    return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.date === date && r.present === true);
  };

  const isNoShow = (attendeeId: string, date: string) => {
    if (isSingleOnetimeNow()) {
      const recs = attendanceRecords.filter((r) => r.attendee_id === attendeeId);
      return recs.some((r) => r.present === false) && !recs.some((r) => r.present === true);
    }
    return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.date === date && r.present === false);
  };

  // 현재 보기(주차/회차/일자) 기준 노쇼 여부
  const isNoShowForView = (attendeeId: string): boolean => {
    if (selectedSession === "all" && event?.type === "club" && event?.club_unit === "weekly") {
      return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.present === false);
    }
    if (selectedSession.startsWith("week_")) {
      const weekDates = getWeekDates(selectedSession);
      return attendanceRecords.some((r) => r.attendee_id === attendeeId && weekDates.includes(r.date) && r.present === false);
    }
    return isNoShow(attendeeId, selectedDate);
  };

  // 3상태 사이클: 빈 → 출석(true) → 노쇼(false) → 빈
  const toggleAttendance = async (attendeeId: string, date: string) => {
    // 일회성 단일: 날짜 무관하게 기존 기록을 토글(출석링크가 today로 넣은 것도 인식)
    const existing = isSingleOnetimeNow()
      ? (attendanceRecords.find((r) => r.attendee_id === attendeeId && r.present === true)
          || attendanceRecords.find((r) => r.attendee_id === attendeeId))
      : attendanceRecords.find((r) => r.attendee_id === attendeeId && r.date === date);
    let newPresent = true; // for journal auto-create

    if (!existing) {
      // 빈 → 출석
      const { data } = await supabase
        .from("event_attendance")
        .insert({ event_id: eventId, attendee_id: attendeeId, date, present: true })
        .select()
        .single();
      if (data) setAttendanceRecords((prev) => [...prev, data as AttendanceRecord]);
      newPresent = true;
    } else if (existing.present === true) {
      // 출석 → 노쇼
      await supabase.from("event_attendance").update({ present: false }).eq("id", existing.id);
      setAttendanceRecords((prev) =>
        prev.map((r) => (r.id === existing.id ? { ...r, present: false } : r))
      );
      newPresent = false;
    } else {
      // 노쇼 → 빈 (삭제)
      await supabase.from("event_attendance").delete().eq("id", existing.id);
      setAttendanceRecords((prev) => prev.filter((r) => r.id !== existing.id));
      newPresent = false;
    }

    // 생명 연동: 출석 체크 시 life_id가 있으면 일지 자동 생성
    if (newPresent) {
      const att = attendees.find(a => a.id === attendeeId);
      if (att?.life_id) {
        const { data: existingJournal } = await supabase.from("journals")
          .select("id").eq("life_id", att.life_id).eq("met_date", date).eq("location", event?.name || "").limit(1);
        if (!existingJournal || existingJournal.length === 0) {
          await supabase.from("journals").insert({
            life_id: att.life_id, met_date: date, location: event?.name || "",
            response: `[${event?.name}] 출석`, purpose: "management",
          });
        }
      }
    }
  };

  const loadAllUsers = async () => {
    if (allUsers.length > 0) return;
    const { data } = await supabase.from("users").select("id, display_name").order("display_name");
    if (data) setAllUsers(data as { id: string; display_name: string }[]);
  };

  // CNUcare 사용자를 이 행사에 연결(event_members 추가) — 연결되면 그 사람 행사 목록에 뜨고 신청 알림을 받는다.
  const connectMember = async (userId: string, displayName: string) => {
    if (members.some((m) => m.user_id === userId)) {
      alert(`${displayName}님은 이미 연결되어 있습니다.`);
      return;
    }
    const { data, error } = await supabase
      .from("event_members")
      .insert({ event_id: eventId, user_id: userId })
      .select("id")
      .single();
    if (error || !data) { alert("연결에 실패했어요: " + (error?.message || "")); return; }
    setMembers((prev) => [...prev, { id: data.id, user_id: userId, display_name: displayName }]);
    setConnectSearch("");
  };

  // 이미지·엑셀 파일 → 참석자 일괄 추가 (행사 생성 때와 동일한 추출 흐름)
  const handleRosterUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || rosterUploading) return;
    setRosterUploading(true);
    try {
      const { images, sheets, skipped } = await parseFiles(files);
      if (skipped.length) alert(`처리할 수 없는 파일 제외: ${skipped.join(", ")}`);
      if (images.length === 0 && sheets.length === 0) return;

      const res = await fetch("/api/extract-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((i) => ({ mime: i.mime, data: i.data })),
          sheets: sheets.map((s) => ({ name: s.name, rows: s.rows, headers: s.headers })),
        }),
      });
      const { attendees: extracted } = await res.json();

      // 이미 명단에 있는 사람은 새로 만들지 않는다 — 이름(공백무시) 또는 전화번호가 겹치면 같은 사람으로 본다.
      // 다만 강소은처럼 급한대로 "이름만" 넣어둔 사람은, 파일에 정보가 있으면 빈 칸만 채워준다(기존 값은 덮지 않음).
      const nk = (s: unknown) => String(s ?? "").replace(/\s+/g, "").toLowerCase();
      const pk = (s: unknown) => String(s ?? "").replace(/\D/g, "");
      const byName = new Map<string, Attendee>();
      const byPhone = new Map<string, Attendee>();
      attendees.forEach((a) => {
        const n = nk(a.name); if (n) byName.set(n, a);
        const p = pk(a.phone); if (p.length >= 9) byPhone.set(p, a);
      });

      // 빈 값일 때만 채우기 (빈 = null/undefined/공백문자열)
      const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
      const hasVal = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

      // 파일의 담당자 이름 → CNUcare 유저 매칭 (완전일치 또는 성 제외 유일일치만; 애매·미존재는 미배정).
      // 비대화형 대량 업로드라 placeholder 자동 생성은 하지 않는다.
      const resolveMgrLocal = (q: unknown): { id: string; display_name: string } | null => {
        const key = nk(q);
        if (!key) return null;
        const exact = allUsers.filter((u) => nk(u.display_name) === key);
        if (exact.length === 1) return exact[0];
        if (exact.length > 1) return null; // 동명이인 → 애매
        const given = allUsers.filter((u) => nk(u.display_name).length >= 2 && nk(u.display_name).slice(1) === key);
        return given.length === 1 ? given[0] : null;
      };
      const matchedMgrIds = new Set<string>(); // event_members 반영용
      let mgrMatchCount = 0;

      const seenNames = new Set<string>(); // 파일 안에서의 중복도 제거
      let dupCount = 0;
      const rows: Record<string, unknown>[] = [];
      const updates: { id: string; patch: Record<string, unknown> }[] = [];
      for (const a of (extracted || []) as any[]) {
        if (!a?.name) continue;
        const name = String(a.name).trim();
        const nkey = nk(name);
        const pkey = pk(a.phone);
        const existing = byName.get(nkey) || (pkey.length >= 9 ? byPhone.get(pkey) : undefined);

        // 이미 있는 사람 → 빈 정보만 보완
        if (existing) {
          const patch: Record<string, unknown> = {};
          const fill = (field: keyof Attendee, newVal: unknown) => {
            if (isEmpty(existing[field]) && hasVal(newVal)) patch[field] = newVal;
          };
          fill("gender", a.gender);
          fill("department", a.department);
          fill("school", a.school);
          fill("phone", a.phone ? formatPhone(a.phone) : null);
          fill("friend_group", a.friendGroup);
          fill("memo", a.memo);
          if (existing.year == null && Number.isFinite(a.year)) patch.year = a.year;
          // 담당 비어있고 파일에 담당자 있으면 매칭해 채움
          if (isEmpty(existing.manager_id) && a.manager) {
            const mgr = resolveMgrLocal(a.manager);
            if (mgr) { patch.manager_id = mgr.id; matchedMgrIds.add(mgr.id); mgrMatchCount++; }
          }
          if (a.custom && Object.keys(a.custom).length) {
            const merged = { ...(existing.custom_data || {}) };
            let changed = false;
            for (const [k, v] of Object.entries(a.custom)) {
              if (isEmpty(merged[k]) && hasVal(v)) { merged[k] = v as string; changed = true; }
            }
            if (changed) patch.custom_data = merged;
          }
          if (Object.keys(patch).length > 0) {
            updates.push({ id: existing.id, patch });
            Object.assign(existing, patch); // 같은 파일 내 뒤 행이 또 덮지 않도록 로컬 반영
          } else {
            dupCount++;
          }
          continue;
        }

        if (seenNames.has(nkey)) { dupCount++; continue; }
        seenNames.add(nkey);
        const mgr = a.manager ? resolveMgrLocal(a.manager) : null;
        if (mgr) { matchedMgrIds.add(mgr.id); mgrMatchCount++; }
        rows.push({
          event_id: eventId,
          name,
          gender: a.gender || null,
          department: a.department || null,
          year: Number.isFinite(a.year) ? a.year : null,
          phone: a.phone ? formatPhone(a.phone) : null,
          school: a.school || null,
          friend_group: a.friendGroup || null,
          memo: a.memo || null,
          manager_id: mgr?.id || null,
          custom_data: a.custom && Object.keys(a.custom).length ? a.custom : null,
          is_member: addType === "member",
          status: "pending",
        });
      }

      if (rows.length === 0 && updates.length === 0) {
        alert(dupCount > 0 ? `모두 이미 명단에 있어요 (중복 ${dupCount}명 제외). 보완할 정보도 없었어요.` : "파일에서 참석자를 찾지 못했어요.");
        return;
      }

      // 빈 정보 보완 (기존 사람 업데이트)
      for (const u of updates) {
        await supabase.from("event_attendees").update(u.patch).eq("id", u.id);
      }

      // 새 사람 추가
      let inserted: Attendee[] = [];
      if (rows.length > 0) {
        const { data, error } = await supabase.from("event_attendees").insert(rows).select("*");
        if (error) { alert("추가에 실패했어요: " + error.message); return; }
        inserted = (data as Attendee[]) || [];
      }

      // 매칭된 담당자를 이 행사 담당 목록(event_members)에 반영 (없던 사람만)
      const newMemberIds = [...matchedMgrIds].filter((id) => !members.some((m) => m.user_id === id));
      if (newMemberIds.length) {
        const { data: mems } = await supabase
          .from("event_members")
          .insert(newMemberIds.map((id) => ({ event_id: eventId, user_id: id })))
          .select("id, user_id");
        if (mems) setMembers((prev) => [
          ...prev,
          ...(mems as any[]).map((m) => ({ id: m.id, user_id: m.user_id, display_name: allUsers.find((u) => u.id === m.user_id)?.display_name || "알 수 없음" })),
        ]);
      }

      // 매칭된 관리자를 섭리회원 참석자로도 추가 (이 행사 명단에 아직 없는 사람만)
      const existingAttNames = new Set([...attendees, ...inserted].map((a) => nk(a.name)));
      const mgrAttendeeRows = [...matchedMgrIds]
        .map((id) => ({ id, dn: allUsers.find((u) => u.id === id)?.display_name || "" }))
        .filter((m) => m.dn && !existingAttNames.has(nk(m.dn)))
        .map((m) => ({ event_id: eventId, name: m.dn, is_member: true, status: "pending" }));
      let insertedMgrs: Attendee[] = [];
      if (mgrAttendeeRows.length) {
        const { data } = await supabase.from("event_attendees").insert(mgrAttendeeRows).select("*");
        insertedMgrs = (data as Attendee[]) || [];
      }

      // 로컬 상태 반영 (보완 patch + 신규 + 관리자 참석자)
      const patchMap = new Map(updates.map((u) => [u.id, u.patch]));
      setAttendees((prev) => [
        ...prev.map((a) => (patchMap.has(a.id) ? { ...a, ...patchMap.get(a.id) } : a)),
        ...inserted,
        ...insertedMgrs,
      ]);
      setShowAddModal(false);
      const added = inserted.length;
      const parts: string[] = [];
      if (added > 0) parts.push(`${added}명 추가`);
      if (updates.length > 0) parts.push(`${updates.length}명 정보 보완`);
      if (mgrMatchCount > 0) parts.push(`관리자 ${mgrMatchCount}명 매칭`);
      if (insertedMgrs.length > 0) parts.push(`관리자 ${insertedMgrs.length}명 참석 추가`);
      if (dupCount > 0) parts.push(`중복 ${dupCount}명 제외`);
      alert(parts.join(" · ") + ".");
    } catch {
      alert("파일 처리에 실패했어요.");
    } finally {
      setRosterUploading(false);
    }
  };

  // 담당 관리자 배정 — 전체 CNUcare 사용자 대상. 이 행사 event_members에 없으면 우선 추가한 뒤 배정한다.
  // (배정된 관리자가 members에 있어야 "담당별" 그룹/드롭다운에서 이름이 제대로 뜬다)
  const assignManager = async (attendeeId: string, userId: string | null) => {
    let managerName = "";
    if (userId) {
      managerName = members.find((m) => m.user_id === userId)?.display_name
        || allUsers.find((x) => x.id === userId)?.display_name || "";
    }
    if (userId && !members.some((m) => m.user_id === userId)) {
      const u = allUsers.find((x) => x.id === userId);
      const { data: mem } = await supabase
        .from("event_members")
        .insert({ event_id: eventId, user_id: userId })
        .select("id")
        .single();
      if (mem) setMembers((prev) => [...prev, { id: mem.id, user_id: userId, display_name: u?.display_name || "알 수 없음" }]);
    }
    await updateAttendeeField(attendeeId, "manager_id", userId);

    // 배정한 관리자를 이 행사의 섭리회원 참석자로도 추가 (명단에 아직 없을 때만)
    if (userId && managerName) {
      const nk = (s: string) => s.replace(/\s+/g, "").toLowerCase();
      const already = attendees.some((a) => nk(a.name) === nk(managerName));
      if (!already) {
        const { data } = await supabase
          .from("event_attendees")
          .insert({ event_id: eventId, name: managerName, is_member: true, status: "pending" })
          .select("*")
          .single();
        if (data) setAttendees((prev) => prev.some((a) => a.id === (data as Attendee).id) ? prev : [...prev, data as Attendee]);
      }
    }
  };

  // 씨엔유 케어에 없는 이름 → 이름만으로 관리자(팀원) placeholder 생성 후 배정. event_members에도 추가된다.
  // 강사처럼 본인이 직접 가입하기 전까지는 백엔드 데이터로만 존재하고 조직도에는 안 뜬다.
  // 나중에 같은 이름으로 회원가입하면 이 레코드를 이어받아(claim) 자동 연결된다. (signup 참고)
  const createManagerAndAssign = async (attendeeId: string, rawName: string) => {
    const nm = rawName.trim();
    if (!nm) return;
    const exist = allUsers.find((u) => u.display_name === nm); // 혹시 이미 있으면 그대로 배정
    if (exist) { await assignManager(attendeeId, exist.id); return; }
    const loginId = `mgr_${Date.now().toString(36)}`;
    const { data: created, error } = await supabase
      .from("users")
      .insert({ login_id: loginId, password: loginId, name: nm, display_name: nm, birth_date: "2000-01-01", phone: "", role: "student", is_placeholder: true })
      .select("id, display_name")
      .single();
    if (error || !created) { alert("관리자 추가에 실패했어요: " + (error?.message || "")); return; }
    setAllUsers((prev) => [...prev, { id: created.id, display_name: created.display_name }].sort((a, b) => a.display_name.localeCompare(b.display_name, "ko")));
    await assignManager(attendeeId, created.id);
  };

  const addMemberAttendee = async (displayName: string) => {
    // 중복 방지
    if (attendees.some((a) => a.name === displayName)) {
      alert(`${displayName}님은 이미 명단에 있습니다.`);
      return;
    }
    const { data } = await supabase
      .from("event_attendees")
      .insert({ event_id: eventId, name: displayName, is_member: true, status: "pending" })
      .select()
      .single();
    if (data) setAttendees((prev) => [...prev, data as Attendee]);
    setMemberSearch("");
    setShowAddModal(false);
  };

  const addAttendee = async () => {
    if (!newAttendeeName.trim()) return;
    const { data } = await supabase
      .from("event_attendees")
      .insert({
        event_id: eventId,
        name: newAttendeeName.trim(),
        gender: newAttendeeGender || null,
        school: newAttendeeSchool || null,
        department: newAttendeeDept || null,
        year: newAttendeeYear ? parseInt(newAttendeeYear) : null,
        phone: newAttendeePhone || null,
        friend_group: newAttendeeFriend || null,
        is_member: false,
        status: "pending",
      })
      .select()
      .single();
    if (data) setAttendees((prev) => [...prev, data as Attendee]);
    setNewAttendeeName("");
    setNewAttendeeGender("");
    setNewAttendeeSchool("");
    setNewAttendeeDept("");
    setNewAttendeeYear("");
    setNewAttendeePhone("");
    setNewAttendeeFriend("");
    setShowAddModal(false);
  };

  // === 명단(엑셀) 공통 헬퍼 ===
  // 고정 컬럼(전용 DB 컬럼) + 신청폼 커스텀 항목(custom_data, 라벨을 키로 저장)
  const ROSTER_FIXED = ["이름", "성별", "학교", "학과", "학년", "연락처", "같이 오시는 분", "팀", "상태", "메모"];
  // 일부 명단은 custom_data 키가 영문 기술 키(age·school_id 등)로 저장돼 있음(AI 추출 경로).
  // 시트 헤더엔 이런 키 대신 항목명이 나오게 매핑. 목록에 없는 키는 이미 항목명이므로 그대로 둠.
  const CUSTOM_LABEL: Record<string, string> = {
    age: "나이",
    birthYear: "출생연도",
    school_id: "학번",
    studentIdYear: "학번(입학연도)",
    sequenceNumber: "연번",
    interviewer: "면접자",
    group: "조",
    relationshipStatus: "연애여부",
    __EMPTY: "미지정 항목",
  };
  const customLabel = (key: string) => CUSTOM_LABEL[key] || key;
  // 커스텀 컬럼을 항목명 기준으로 구성. 서로 다른 키가 같은 항목명이면 한 열로 합침(값 있는 쪽 사용).
  const rosterCustomColumns = (list: Attendee[]): { cols: string[]; sources: Record<string, string[]> } => {
    const cols: string[] = [];
    const sources: Record<string, string[]> = {};
    list.forEach((a) => Object.keys(a.custom_data || {}).forEach((k) => {
      const label = customLabel(k);
      if (!sources[label]) { sources[label] = []; cols.push(label); }
      if (!sources[label].includes(k)) sources[label].push(k);
    }));
    return { cols, sources };
  };
  const rosterRow = (a: Attendee, customCols: string[], sources: Record<string, string[]>): Record<string, string> => {
    const row: Record<string, string> = {
      "이름": a.name || "",
      "성별": a.gender || "",
      "학교": a.school || "",
      "학과": a.department || "",
      "학년": a.year != null ? `${a.year}학년` : "",
      "연락처": a.phone || "",
      "같이 오시는 분": a.friend_group || "",
      "팀": a.team || "",
      "상태": a.status || "",
      "메모": a.memo || "",
    };
    const cd = a.custom_data || {};
    for (const label of customCols) {
      let v = "";
      for (const k of sources[label] || []) {
        const val = cd[k];
        if (val != null && String(val).trim() !== "") { v = String(val); break; }
      }
      row[label] = v;
    }
    return row;
  };
  const rosterFileName = (suffix: string) =>
    `${(event?.name || "행사").replace(/[\\/:*?"<>|]/g, "_")}_${suffix}.xlsx`;
  // 엑셀 시트명 제약(금지문자·31자·중복불가) 처리
  const sheetSafe = (name: string, used: Set<string>): string => {
    const base = (name.replace(/[\\/?*[\]:]/g, " ").trim() || "기타").slice(0, 31);
    let nm = base, n = 2;
    while (used.has(nm)) { nm = `${base.slice(0, 28)} ${n}`; n++; }
    used.add(nm);
    return nm;
  };

  // 명단 미리보기 — 앱 내 모달로 표를 띄우고 거기서 .xlsx 다운로드 / 구글 시트용 복사
  // (새 탭/window.open은 팝업 차단·모바일에서 조용히 막혀서 모달로 처리)
  // sections: 엑셀 시트로 분리할 단위 (학교별이면 학교마다, 전체면 1개). 컬럼은 전체 기준 통일.
  const openRosterPreview = (fileSuffix: string, sectionsIn: { name: string; list: Attendee[] }[]) => {
    if (attendees.length === 0) { alert("명단이 비어 있어요."); return; }
    const { cols: customCols, sources } = rosterCustomColumns(attendees);
    const cols = [...ROSTER_FIXED, ...customCols];
    const visible = sectionsIn.filter((s) => s.list.length > 0);
    if (visible.length === 0) { alert("명단이 비어 있어요."); return; }
    const multi = visible.length > 1;
    const sections = visible.map((s) => ({ name: s.name, rows: s.list.map((a) => rosterRow(a, customCols, sources)) }));
    const allRows = sections.flatMap((s) => s.rows);

    // .xlsx (섹션마다 시트) → 다운로드용 blob URL
    const wb = XLSX.utils.book_new();
    const used = new Set<string>();
    sections.forEach((s) => {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows, { header: cols }), sheetSafe(s.name, used));
    });
    const wbArray = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([wbArray], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const xlsxUrl = URL.createObjectURL(blob);

    // TSV (구글 시트용) — 전 섹션 행을 이어붙임(학교 컬럼 포함이라 구분 유지)
    const tsv = [cols, ...allRows.map((r) => cols.map((c) => r[c] ?? ""))]
      .map((line) => line.map((cell) => String(cell).replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t"))
      .join("\n");

    setRoster((prev) => {
      if (prev) URL.revokeObjectURL(prev.xlsxUrl);
      return { title: `${event?.name || "행사"} 명단`, fileName: rosterFileName(fileSuffix), cols, sections, total: allRows.length, tsv, xlsxUrl, multi };
    });
  };

  const closeRoster = () => {
    setRoster((prev) => { if (prev) URL.revokeObjectURL(prev.xlsxUrl); return null; });
  };
  const copyRosterTsv = async () => {
    if (!roster) return;
    try {
      await navigator.clipboard.writeText(roster.tsv);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = roster.tsv; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setRosterCopied(true);
    setTimeout(() => setRosterCopied(false), 1500);
  };

  // 전체 명단 미리보기(시트 1개)
  const openRosterAll = () => openRosterPreview("전체명단", [{ name: "전체 명단", list: attendees }]);

  // 학교별 명단 미리보기(학교마다 시트 분리)
  const openRosterBySchool = () => {
    const sections = SCHOOL_LIST.map((school) => ({ name: school, list: attendees.filter((a) => a.school === school) }));
    sections.push({ name: "기타", list: attendees.filter((a) => !SCHOOL_LIST.includes(a.school || "")) });
    openRosterPreview("학교별명단", sections);
  };

  // 원회원 행사: 100% 출석자만 가입하므로 출석체크 불필요, 명단은 전원 생명(섭리회원 제외)
  const isWonMember = event?.name === "원회원";

  // --- Sorting ---
  const sortAttendees = (list: Attendee[]) => {
    return [...list].sort((a, b) => {
      // 노쇼는 무조건 맨 아래 (오는 사람이 잘 보이게)
      const aNo = isNoShowForView(a.id) ? 1 : 0;
      const bNo = isNoShowForView(b.id) ? 1 : 0;
      if (aNo !== bNo) return aNo - bNo;
      if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
      if (sortBy === "year") return (a.year || 0) - (b.year || 0);
      if (sortBy === "recent") return (b.created_at || "").localeCompare(a.created_at || ""); // 최신 신청자 상단
      return 0;
    });
  };

  // --- Grouping ---
  const groupAttendees = (list: Attendee[]): { label: string; items: Attendee[] }[] => {
    // 생명만 필터, 또는 원회원 행사(섭리회원은 명단에 포함 안 함)
    const hideMembers = lifeOnly || event?.name === "원회원";
    const filtered = hideMembers ? list.filter((a) => !a.is_member) : list;
    const sorted = sortAttendees(filtered);

    if (groupBy === "default") {
      // 원회원 행사에서 최신순 정렬이면 신청 날짜별 구분선 — 신청 당일 누가 들어왔는지 바로 확인
      if (isWonMember && sortBy === "recent") {
        const dateKey = (a: Attendee) =>
          a.created_at ? new Date(a.created_at).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }) : "";
        const todayKey = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
        const byDate: Record<string, Attendee[]> = {};
        const noDate: Attendee[] = [];
        sorted.forEach((a) => {
          const k = dateKey(a);
          if (!k) noDate.push(a);
          else (byDate[k] = byDate[k] || []).push(a);
        });
        const groups = Object.entries(byDate)
          .sort(([a], [b]) => b.localeCompare(a)) // 최신 날짜 먼저
          .map(([k, items]) => {
            const d = new Date(k + "T00:00:00");
            const label = `${d.getMonth() + 1}월 ${d.getDate()}일${k === todayKey ? " (오늘)" : ""} · ${items.length}명`;
            return { label, items };
          });
        if (noDate.length) groups.push({ label: `날짜 미상 · ${noDate.length}명`, items: noDate });
        return groups;
      }
      return [{ label: "", items: sorted }];
    }

    if (groupBy === "attendance") {
      const present = sorted.filter((a) => isPresentForView(a.id));
      const absent = sorted.filter((a) => !isPresentForView(a.id));
      return [
        { label: `출석 (${present.length})`, items: present },
        { label: `미출석 (${absent.length})`, items: absent },
      ];
    }

    if (groupBy === "team") {
      const groups: Record<string, Attendee[]> = {};
      sorted.forEach((a) => {
        const key = a.team || "미배정";
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      });
      // 1팀부터 팀 번호 오름차순, 숫자 없는 팀명·미배정은 맨 아래
      return Object.entries(groups)
        .sort(([a], [b]) => {
          if (a === "미배정") return 1;
          if (b === "미배정") return -1;
          const na = parseInt(a), nb = parseInt(b);
          const va = Number.isFinite(na) ? na : Infinity;
          const vb = Number.isFinite(nb) ? nb : Infinity;
          return va !== vb ? va - vb : a.localeCompare(b, "ko");
        })
        .map(([label, items]) => ({ label, items }));
    }

    if (groupBy === "manager") {
      const groups: Record<string, Attendee[]> = {};
      sorted.forEach((a) => {
        const mgr = members.find((m) => m.user_id === a.manager_id);
        // 섭리회원(관리자 본인)은 배정된 관리자가 없어도 미배정이 아니라 본인 이름 그룹으로
        const key = mgr ? mgr.display_name : (a.is_member ? a.name : "미배정");
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      });
      // 관리자 이름 가나다순, 미배정은 맨 아래
      return Object.entries(groups)
        .sort(([a], [b]) => (a === "미배정" ? 1 : b === "미배정" ? -1 : a.localeCompare(b, "ko")))
        .map(([label, items]) => ({ label, items }));
    }

    if (groupBy === "friend") {
      // 같이 오는 친구를 '이름'으로 상호·연쇄 매칭해 한 그룹으로 묶음(union-find).
      // 예: 박수훈이 '이미철'을 적고 이미철이 '성원빈'을 적으면 → 박수훈·이미철·성원빈 한 그룹.
      const nk = (s: string) => s.replace(/\s+/g, "").toLowerCase();
      const byName = new Map<string, number[]>();
      sorted.forEach((a, i) => {
        const k = nk(a.name);
        if (!k) return;
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k)!.push(i);
      });
      // 토큰이 이름과 일치하는 참석자 인덱스들. 조사(와/과/이랑 등)가 붙었으면 떼고 재시도.
      const matchName = (tok: string): number[] => {
        if (byName.has(tok)) return byName.get(tok)!;
        for (const cut of [1, 2]) {
          const t2 = tok.slice(0, tok.length - cut);
          if (t2.length >= 2 && byName.has(t2)) return byName.get(t2)!;
        }
        return [];
      };
      const parent = sorted.map((_, i) => i);
      const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
      sorted.forEach((a, i) => {
        (a.friend_group || "")
          .split(/[,\n/·&+]|\s+/)
          .map((t) => nk(t))
          .filter(Boolean)
          .forEach((tok) => matchName(tok).forEach((j) => { if (j !== i) union(i, j); }));
      });
      const comps = new Map<number, Attendee[]>();
      sorted.forEach((a, i) => {
        const r = find(i);
        if (!comps.has(r)) comps.set(r, []);
        comps.get(r)!.push(a);
      });
      const groups: { label: string; items: Attendee[] }[] = [];
      const solo: Attendee[] = [];
      comps.forEach((items) => {
        if (items.length > 1) groups.push({ label: `${items.map((x) => x.name).join("·")} (${items.length})`, items });
        else solo.push(items[0]);
      });
      groups.sort((a, b) => b.items.length - a.items.length); // 큰 친구 그룹 먼저
      if (solo.length) groups.push({ label: `개인 (${solo.length})`, items: solo }); // 혼자 온 사람은 맨 아래
      return groups;
    }

    // 학교별 그룹
    if (groupBy === "school") {
      const bySchool: Record<string, Attendee[]> = {};
      const noSchool: Attendee[] = [];
      sorted.forEach((a) => {
        const s = (a.school || "").trim();
        if (!s) noSchool.push(a);
        else (bySchool[s] = bySchool[s] || []).push(a);
      });
      const groups = Object.entries(bySchool)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([school, items]) => ({ label: `${school} (${items.length})`, items }));
      if (noSchool.length > 0) groups.push({ label: `미입력 (${noSchool.length})`, items: noSchool });
      return groups;
    }

    // 커스텀 필드 그룹 (custom_data 기반) — 값별로 분류
    if (groupBy.startsWith("custom_")) {
      const fieldLabel = groupBy.replace("custom_", "");
      const byValue: Record<string, Attendee[]> = {};
      const empty: Attendee[] = [];
      sorted.forEach((a) => {
        const raw = (a.custom_data?.[fieldLabel] || "").trim();
        if (!raw) { empty.push(a); return; }
        // 체크박스는 "옵션1, 옵션2"처럼 저장 → 첫 값으로 분류
        const val = raw.split(",")[0].trim();
        (byValue[val] = byValue[val] || []).push(a);
      });
      const groups = Object.entries(byValue)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([val, items]) => ({ label: `${val} (${items.length})`, items }));
      if (empty.length > 0) groups.push({ label: `미입력 (${empty.length})`, items: empty });
      return groups;
    }

    return [{ label: "", items: sorted }];
  };

  // 커스텀 드롭다운/체크박스 필드만 그룹 옵션으로 추출
  const customGroupOptions: { value: string; label: string }[] = (() => {
    const BUILTIN_IDS = new Set(["name", "school", "gender", "year", "department", "phone", "friend_group"]);
    const groupableFields = regFields
      // builtin 필드는 컬럼에 저장되므로 custom_data 기반 그룹에서 제외
      .filter((f) => !f.builtin && !BUILTIN_IDS.has(f.id) && (f.type === "dropdown" || f.type === "checkbox"))
      .map((f) => f.label);
    return groupableFields.map((k) => ({ value: `custom_${k}`, label: k }));
  })();

  // --- Detail tab helpers ---
  const updateAttendeeField = async (id: string, field: string, value: any) => {
    await supabase.from("event_attendees").update({ [field]: value }).eq("id", id);
    let updated = attendees.map((a) => (a.id === id ? { ...a, [field]: value } : a));

    if (field === "team") {
      // 팀 변경 → 같은 관리자의 모든 참가자도 같이 이동
      const me = updated.find((a) => a.id === id);
      if (me?.manager_id) {
        const sameGroup = updated.filter((a) => a.manager_id === me.manager_id && a.id !== id);
        for (const a of sameGroup) {
          await supabase.from("event_attendees").update({ team: value }).eq("id", a.id);
        }
        updated = updated.map((a) => a.manager_id === me.manager_id ? { ...a, team: value } : a);
      }
    }

    if (field === "manager_id" && value) {
      // 관리자 변경 → 해당 관리자의 기존 팀으로 자동 이동
      const managerAttendee = updated.find((a) => a.manager_id === value && a.id !== id && a.team);
      if (managerAttendee?.team) {
        await supabase.from("event_attendees").update({ team: managerAttendee.team }).eq("id", id);
        updated = updated.map((a) => a.id === id ? { ...a, team: managerAttendee.team } : a);
      }
    }

    setAttendees(updated);
  };

  // --- Status tab helpers ---
  const getStats = () => {
    // 현황 탭은 게스트(섭리회원이 아닌 신청자)만 집계
    const guests = attendees.filter((a) => !a.is_member);
    const total = guests.length;
    const presentToday = guests.filter((a) => attendanceRecords.some((r) => r.attendee_id === a.id && r.present));
    const male = guests.filter((a) => a.gender === "남").length;
    const female = guests.filter((a) => a.gender === "여").length;
    const passed = guests.filter((a) => a.status === "pass").length;
    return { total, totalAttended: presentToday.length, male, female, passed };
  };

  // 현황 막대그래프 대상: 학년·성별(기본) + 신청폼의 드롭다운/체크박스(값이 정형화돼 집계 가능한 항목).
  // 학과는 자유 입력 텍스트라 표기가 제각각이라 집계 대상에서 제외한다.
  const getChartFields = (): ChartField[] => {
    const fields: ChartField[] = [
      { key: "year", label: "학년", kind: "year" },
      { key: "gender", label: "성별", kind: "gender" },
    ];
    // 신청폼 커스텀 필드 중 선택형(드롭다운·체크박스)만 — custom_data는 라벨을 키로 저장됨(register 폼 참고)
    for (const f of regFields) {
      if (f.builtin) continue;
      if (f.type === "dropdown" || f.type === "checkbox") {
        fields.push({ key: f.label, label: f.label, kind: "custom", split: f.type === "checkbox" });
      }
    }
    return fields;
  };

  const getChartData = (field: ChartField) => {
    const counts: Record<string, number> = {};
    const bump = (k: string) => { counts[k] = (counts[k] || 0) + 1; };
    attendees.filter((a) => !a.is_member).forEach((a) => {
      if (field.kind === "year") { bump(a.year != null ? formatYear(a.year) : "미입력"); return; }
      if (field.kind === "gender") { bump(a.gender || "미입력"); return; }
      const raw = String(a.custom_data?.[field.key] ?? "").trim();
      if (!raw) { bump("미입력"); return; }
      // 체크박스(복수 선택)는 "옵션A, 옵션B"로 저장되므로 옵션별로 나눠 센다
      if (field.split) raw.split(",").map((s) => s.trim()).filter(Boolean).forEach(bump);
      else bump(raw);
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return { entries, max };
  };

  // 그래프 막대를 눌렀을 때: 그 항목·값에 해당하는 참가자 명단 (집계와 동일한 분류 규칙)
  const getChartMembers = (field: ChartField, value: string) => {
    return attendees.filter((a) => !a.is_member).filter((a) => {
      if (field.kind === "year") return (a.year != null ? formatYear(a.year) : "미입력") === value;
      if (field.kind === "gender") return (a.gender || "미입력") === value;
      const raw = String(a.custom_data?.[field.key] ?? "").trim();
      if (value === "미입력") return !raw;
      if (field.split) return raw.split(",").map((s) => s.trim()).includes(value);
      return raw === value;
    });
  };
  const getAttendanceRates = () => {
    const isWeekly = event?.type === "club" && event?.club_unit === "weekly";
    const lifeAttendees = attendees.filter((a) => !a.is_member);

    if (isWeekly) {
      // 주차별: 1주 = 1회
      const allDates = [...new Set(attendanceRecords.map((r) => r.date))].sort();
      if (allDates.length === 0) return [];
      const firstDate = new Date(allDates[0]);
      const firstMonday = new Date(firstDate);
      firstMonday.setDate(firstMonday.getDate() - ((firstMonday.getDay() + 6) % 7));
      const lastDate = new Date(allDates[allDates.length - 1]);
      // 총 주차 수
      const totalWeeks = Math.ceil((lastDate.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;

      return lifeAttendees.map((a) => {
        const myRecords = attendanceRecords.filter((r) => r.attendee_id === a.id && r.present);
        // 출석한 주차 수 (같은 주에 여러 날 출석해도 1회)
        const attendedWeeks = new Set<number>();
        myRecords.forEach(r => {
          const diff = Math.floor((new Date(r.date).getTime() - firstMonday.getTime()) / (7 * 86400000));
          attendedWeeks.add(diff);
        });
        const attended = attendedWeeks.size;
        const rate = Math.round((attended / totalWeeks) * 100);
        return { name: a.name, attended, total: totalWeeks, rate };
      }).sort((a, b) => b.rate - a.rate);
    }

    // 일반: 날짜별
    return lifeAttendees.map((a) => {
      const myRecords = attendanceRecords.filter((r) => r.attendee_id === a.id);
      const attended = myRecords.filter((r) => r.present).length;
      const allDates = new Set(attendanceRecords.map((r) => r.date));
      const totalPossible = allDates.size || 1;
      const rate = Math.round((attended / totalPossible) * 100);
      return { name: a.name, attended, total: totalPossible, rate };
    }).sort((a, b) => b.rate - a.rate);
  };

  // 완료된 리포트(type=event)를 폴링 — 완료/실패 시 버튼 상태 갱신
  const pollEventReport = (id: string) => {
    if (aiPollRef.current) clearInterval(aiPollRef.current);
    let tries = 0;
    aiPollRef.current = setInterval(async () => {
      tries++;
      fetch("/api/process-reports").catch(() => {}); // 서버 처리 깨우기
      const { data } = await supabase.from("reports").select("id, status, content").eq("id", id).single();
      if (data) {
        setEventReport(data as { id: string; status: string; content: string });
        if (data.status !== "pending" && data.status !== "processing") {
          if (aiPollRef.current) clearInterval(aiPollRef.current);
        }
      }
      if (tries > 60 && aiPollRef.current) clearInterval(aiPollRef.current); // ~5분 안전장치
    }, 5000);
  };

  // AI 분석 시작 (백그라운드). 팝업 없이 버튼만 '분석 중'으로 바뀜.
  const startEventAnalysis = async () => {
    try {
      const stats = getStats();
      // 참가자 분포 = 현황 그래프와 동일(학년·성별·신청폼 선택형 항목)
      const distributions = getChartFields().map((f) => ({
        label: f.label,
        entries: getChartData(f).entries, // [[값, 인원], ...]
      }));
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "event",
          eventId,
          eventName: event?.name,
          eventType: event?.type,
          totalApplicants: stats.total,
          totalAttended: stats.totalAttended,
          male: stats.male,
          female: stats.female,
          passed: stats.passed,
          distributions,
          feedbacks: feedbacks.map((f) => ({ content: f.content, type: f.type })),
          createdBy: getUser()?.id,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setEventReport({ id: data.id, status: "pending", content: "" });
        pollEventReport(data.id);
      } else {
        alert(data.error || "분석을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      alert("분석 요청에 실패했어요. 네트워크를 확인해 주세요.");
    }
  };

  // 레포트 커스텀 — 추가 요청을 반영해 재분석
  const runAiCustom = async () => {
    if (!eventReport || !aiCustomText.trim()) return;
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "custom", reportId: eventReport.id, instruction: aiCustomText.trim() }),
    });
    const data = await res.json();
    if (data.id) {
      setEventReport({ ...eventReport, status: "pending", content: "" });
      setAiCustomOpen(false);
      setAiCustomText("");
      pollEventReport(eventReport.id);
    }
  };

  // 기존 행사 리포트 로드(버튼 상태 복원) + 진행 중이면 폴링 재개
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("reports")
        .select("id, status, content").eq("type", "event").eq("target_id", eventId)
        .order("created_at", { ascending: false }).limit(1);
      if (cancelled) return;
      const rep = data?.[0] as { id: string; status: string; content: string } | undefined;
      if (rep) {
        setEventReport(rep);
        if (rep.status === "pending" || rep.status === "processing") pollEventReport(rep.id);
      }
    })();
    return () => { cancelled = true; if (aiPollRef.current) clearInterval(aiPollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  if (loading || !event) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  // 상세 탭: 검색어로 참가자 필터 (이름·연락처·학과·학교)
  const detailShown = (() => {
    const q = detailSearch.trim().toLowerCase();
    if (!q) return attendees;
    return attendees.filter((a) =>
      [a.name, a.phone, a.department, a.school].some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  })();

  // 원회원 명단: 사람 클릭 시 펼쳐지는 상세 카드(상세 탭과 동일한 정보/편집 — 팀·담당·결제 등 행사용 항목 제외)
  const renderWonExpanded = (a: Attendee) => {
    const isEditing = editingAttendee === a.id;
    return (
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
        <div className="flex justify-end">
          {isEditing ? (
            <button onClick={(e) => { e.stopPropagation(); setEditingAttendee(null); }}
              className="text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded-full">완료</button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); setEditingAttendee(a.id); }}
              className="text-[11px] text-blue-600 border border-blue-300 px-2.5 py-1 rounded-full hover:bg-blue-50">수정</button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[10px] text-gray-400">학교</span>
                <input type="text" value={a.school || ""} onChange={(e) => updateAttendeeField(a.id, "school", e.target.value || null)}
                  placeholder="학교" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400">학과</span>
                <input type="text" value={a.department || ""} onChange={(e) => updateAttendeeField(a.id, "department", e.target.value || null)}
                  placeholder="학과" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[10px] text-gray-400">연락처</span>
                <input type="tel" value={a.phone || ""} onChange={(e) => updateAttendeeField(a.id, "phone", e.target.value || null)}
                  placeholder="연락처" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
              </div>
              <div></div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[10px] text-gray-400">성별</span>
                <select value={a.gender || ""} onChange={(e) => updateAttendeeField(a.id, "gender", e.target.value || null)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400">
                  <option value="">미선택</option>
                  <option value="남">남</option>
                  <option value="여">여</option>
                </select>
              </div>
              <div>
                <span className="text-[10px] text-gray-400">학년</span>
                <select value={a.year?.toString() || ""} onChange={(e) => updateAttendeeField(a.id, "year", e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400">
                  <option value="">미선택</option>
                  <option value="1">1학년</option>
                  <option value="2">2학년</option>
                  <option value="3">3학년</option>
                  <option value="4">4학년</option>
                  <option value="0">졸업유예</option>
                </select>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-gray-400">친구</span>
              <InlineInput value={a.friend_group || ""} onCommit={(v) => updateAttendeeField(a.id, "friend_group", v || null)}
                placeholder="함께 신청한 친구" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
            </div>
            {a.custom_data && Object.entries(a.custom_data).map(([key]) => {
              const labelFromForm = regFields.find((f) => f.id === key)?.label;
              const displayLabel = labelFromForm || key;
              return (
                <div key={key}>
                  <span className="text-[10px] text-gray-400">{displayLabel}</span>
                  <InlineInput value={a.custom_data?.[key] || ""} onCommit={(v) => {
                    const updated = { ...(a.custom_data || {}), [key]: v };
                    updateAttendeeField(a.id, "custom_data", updated);
                  }} placeholder={displayLabel} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            {a.phone && (<div><span className="text-gray-400 text-[10px]">연락처</span><p>{a.phone}</p></div>)}
            {a.school && (<div><span className="text-gray-400 text-[10px]">학교</span><p>{a.school}</p></div>)}
            {a.department && (<div><span className="text-gray-400 text-[10px]">학과</span><p>{a.department}</p></div>)}
            {a.gender && (<div><span className="text-gray-400 text-[10px]">성별</span><p>{a.gender}</p></div>)}
            {a.year != null && (<div><span className="text-gray-400 text-[10px]">학년</span><p>{formatYear(a.year)}</p></div>)}
            {a.friend_group && (<div className="col-span-2"><span className="text-gray-400 text-[10px]">친구</span><p>{a.friend_group}</p></div>)}
            {a.custom_data && Object.entries(a.custom_data).filter(([, v]) => v).map(([key, val]) => {
              const labelFromForm = regFields.find((f) => f.id === key)?.label;
              return (
                <div key={key} className="col-span-2"><span className="text-gray-400 text-[10px]">{labelFromForm || key}</span><p className="whitespace-pre-wrap">{val}</p></div>
              );
            })}
            {!a.phone && !a.school && !a.department && !a.gender && a.year == null && !a.friend_group && !(a.custom_data && Object.keys(a.custom_data).length > 0) && (
              <p className="col-span-2 text-gray-400">입력된 정보 없음</p>
            )}
          </div>
        )}
        {!isEditing && (
          <div className="space-y-2">
            <div>
              <span className="text-[10px] text-gray-400">메모</span>
              <InlineTextarea value={a.memo || ""} onCommit={(v) => updateAttendeeField(a.id, "memo", v || null)}
                placeholder="메모" rows={2}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-blue-400" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400">파악내용</span>
              <InlineTextarea value={a.assessment || ""} onCommit={(v) => updateAttendeeField(a.id, "assessment", v || null)}
                placeholder="특이사항·MBTI·본가·연애 여부 등" rows={3}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-blue-400" />
            </div>
          </div>
        )}
        <button
          onClick={async (e) => {
            e.stopPropagation();
            if (!confirm(`"${a.name}" 참가자를 삭제하시겠습니까?`)) return;
            await supabase.from("event_attendance").delete().eq("attendee_id", a.id);
            await supabase.from("event_attendees").delete().eq("id", a.id);
            setAttendees(attendees.filter((x) => x.id !== a.id));
          }}
          className="text-xs text-red-400 hover:text-red-600"
        >
          참가자 삭제
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center shrink-0">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push(basePath); }} className="text-gray-500 mr-3">&larr;</button>
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-lg font-bold truncate">{event.name}</h1>
          {/* 원회원은 멤버십 행사 — 일회성/동아리 라벨 없음 */}
          {event.name !== "원회원" && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
              event.type === "club" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
            }`}>
              {event.type === "club" ? "동아리" : "일회성"}
            </span>
          )}
        </div>
        {/* 새로고침: DB 다시 불러오기 (실시간 출석 반영용) — 오른쪽 상단 */}
        <button
          onClick={async () => { if (refreshing) return; setRefreshing(true); await fetchAll(); setRefreshing(false); }}
          title="새로고침"
          aria-label="새로고침"
          className="ml-auto shrink-0 text-gray-400 hover:text-blue-600 disabled:opacity-50"
          disabled={refreshing}
        >
          <svg className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </header>

      {/* 중복 의심자 배너 — 다른 행사·프로젠·생명과 이름이 겹치는 참여자. 확인 눌러야 사라짐. */}
      {dupSuspects.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 shrink-0 max-h-44 overflow-y-auto">
          <p className="text-xs font-bold text-amber-800 mb-1.5 flex items-center gap-1 flex-wrap">
            ⚠️ 중복 신청 {dupSuspects.length}명
            <span className="font-normal">— <span className="text-red-600 font-semibold">빨강=이름+번호 일치(확정)</span> · <span className="text-amber-600 font-semibold">주황=이름만 일치(의심)</span></span>
          </p>
          <div className="space-y-1.5">
            {dupSuspects.map((s) => {
              const confirmed = s.matchType === "phone";
              return (
              <div key={s.attendeeId} className={`flex items-center gap-2 bg-white border rounded-lg px-2.5 py-1.5 ${confirmed ? "border-red-300" : "border-amber-200"}`}>
                <button onClick={() => setDupDetail(s)} className="min-w-0 flex-1 text-left">
                  <span className={`text-sm font-semibold text-gray-900 underline underline-offset-2 ${confirmed ? "decoration-red-300" : "decoration-amber-300"}`}>{s.name}</span>
                  <span className={`ml-1 text-[10px] font-bold ${confirmed ? "text-red-600" : "text-amber-600"}`}>{confirmed ? "중복" : "의심"}</span>
                  {s.isLife && <span className="ml-1 text-[10px] font-bold text-rose-600">생명</span>}
                  <span className="block text-xs text-gray-500 truncate">{s.summary}</span>
                </button>
                <button onClick={() => setDupDetail(s)} className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${confirmed ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700"}`}>
                  상세
                </button>
                <button
                  onClick={() => confirmDup(s.attendeeId)}
                  disabled={dupConfirming === s.attendeeId}
                  className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full text-white disabled:opacity-50 ${confirmed ? "bg-red-600" : "bg-amber-600"}`}
                >
                  {dupConfirming === s.attendeeId ? "…" : "확인"}
                </button>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        {(([
          ["attendance", isWonMember ? "명단" : "출석"],
          ...(isWonMember ? [] : [["detail", "상세"]]),
          ["status", "현황"],
          ["settings", "설정"],
        ] as [Tab, string][])).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2.5 text-sm font-medium text-center border-b-2 transition-colors ${
              activeTab === key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* ===== 출석 Tab ===== */}
        {activeTab === "attendance" && (
          <div className="p-4 space-y-3">
            {/* Form generation buttons — 원회원은 사이트에서 직접 신청받으므로 폼 생성 불필요 */}
            {!isWonMember && (
            <div className="grid grid-cols-2 gap-2">
              {regFormUrl ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 overflow-hidden">
                  <p className="text-[10px] text-green-600 mb-1">신청폼</p>
                  <div className="flex gap-1">
                    <button onClick={() => { navigator.clipboard.writeText(regFormUrl); alert("복사!"); }}
                      className="flex-1 text-[10px] bg-green-600 text-white py-1.5 rounded font-medium">복사</button>
                    <button onClick={() => { if (regFields.length === 0) setRegFields([...defaultRegFields]); setShowRegGen(true); }}
                      className="text-[10px] bg-green-100 text-green-700 py-1.5 px-2 rounded font-medium">수정</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { if (regFields.length === 0) setRegFields([...defaultRegFields]); setShowRegGen(true); }} className="text-xs bg-green-600 text-white py-2.5 rounded-lg font-medium">신청폼 생성</button>
              )}
              {checkinFormUrl ? (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 overflow-hidden">
                  <p className="text-[10px] text-orange-600 mb-1">출석체크</p>
                  <div className="flex gap-1">
                    <button onClick={() => { navigator.clipboard.writeText(checkinFormUrl); alert("복사!"); }}
                      className="flex-1 text-[10px] bg-orange-600 text-white py-1.5 rounded font-medium">복사</button>
                    <button onClick={() => setShowCheckinGen(true)}
                      className="text-[10px] bg-orange-100 text-orange-700 py-1.5 px-2 rounded font-medium">수정</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCheckinGen(true)} className="text-xs bg-orange-500 text-white py-2.5 rounded-lg font-medium">출석체크 생성</button>
              )}
            </div>
            )}

            {/* Club weekly: 주차별 드롭다운 */}
            {event.type === "club" && event.club_unit === "weekly" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="all">전체 주차</option>
                  {(() => {
                    // 출석 기록에서 주차 자동 계산
                    const dates = [...new Set(attendanceRecords.map(r => r.date))].sort();
                    if (dates.length === 0) return null;
                    const firstDate = new Date(dates[0]);
                    const weeks = new Map<number, { start: string; end: string }>();
                    dates.forEach(d => {
                      const diff = Math.floor((new Date(d).getTime() - firstDate.getTime()) / (7 * 86400000));
                      const weekNum = diff + 1;
                      if (!weeks.has(weekNum)) {
                        const ws = new Date(firstDate.getTime() + diff * 7 * 86400000);
                        const we = new Date(ws.getTime() + 6 * 86400000);
                        weeks.set(weekNum, {
                          start: `${ws.getMonth()+1}.${ws.getDate()}`,
                          end: `${we.getMonth()+1}.${we.getDate()}`,
                        });
                      }
                    });
                    return [...weeks.entries()].sort((a, b) => a[0] - b[0]).map(([num, w]) => (
                      <option key={num} value={`week_${num}`}>{`${Math.ceil(new Date(dates[0]).getMonth()/1)+1}월 ${num}주차 (${w.start}~${w.end})`}</option>
                    ));
                  })()}
                </select>
                <button
                  onClick={() => setShowRateModal(true)}
                  className="text-xs text-blue-600 border border-blue-300 rounded-full px-3 py-1.5 hover:bg-blue-50 whitespace-nowrap"
                >
                  출석률
                </button>
              </div>
            )}

            {/* 회차별 드롭다운 — 일회성 단일 행사(회차 0~1개)는 숨김(단일 출석으로 표시).
                회차를 여러 개 나눈 행사나 club에서만 노출 */}
            {!(event.type === "club" && event.club_unit === "weekly") && sessions.length > 0 && !(event.type === "onetime" && sessions.length <= 1) && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedSession}
                  onChange={(e) => {
                    setSelectedSession(e.target.value);
                    if (e.target.value !== "all") setSelectedDate(e.target.value);
                  }}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="all">전체 회차</option>
                  {sessions.map((s) => (
                    <option key={s.number} value={s.date}>{s.number}회차 ({new Date(s.date).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })})</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowRateModal(true)}
                  className="text-xs text-blue-600 border border-blue-300 rounded-full px-3 py-1.5 hover:bg-blue-50 whitespace-nowrap"
                >
                  출석률
                </button>
              </div>
            )}

            {/* Date selector — club non-weekly에 회차 없을 때만 직접 날짜 입력
                일회성+0회차는 날짜 칸 안 보임 (단일 출석, event.created_at 사용) */}
            <div className="flex items-center gap-2">
              {event.type === "club" && event.club_unit !== "weekly" && sessions.length === 0 && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-blue-400"
                />
              )}
              <button
                onClick={() => { setShowAddModal(true); loadAllUsers(); }}
                className="ml-auto text-xs text-blue-600 border border-blue-300 rounded-full px-3 py-1.5 hover:bg-blue-50 whitespace-nowrap"
              >
                + 참석자 추가
              </button>
            </div>

            {/* Sort + Group */}
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap items-center">
                {([["name", "이름순"], ["year", "학년순"], ["recent", "최신순"]] as [SortOption, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      sortBy === val ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {!isWonMember && (
                  <button
                    onClick={() => setLifeOnly(!lifeOnly)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ml-auto ${
                      lifeOnly ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    생명만
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["default", "기본"],
                  ["team", "팀별"],
                  ["manager", "관리자별"],
                  ["school", "학교별"],
                  ["attendance", "출석별"],
                  ["friend", "친구별"],
                  ...customGroupOptions.map((o) => [o.value, o.label] as [string, string]),
                ]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setGroupBy(val)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      groupBy === val ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 러닝 주차별 표 뷰 */}
            {event?.type === "club" && event?.club_unit === "weekly" && selectedSession !== "all" && selectedSession.startsWith("week_") && (() => {
              const weekDates = getWeekDates(selectedSession);
              const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

              const dayGroups = weekDates.map(d => {
                const dayRecords = attendanceRecords.filter(r => r.date === d && r.present);
                const teamMap = new Map<string, string[]>();
                dayRecords.forEach(r => {
                  const gid = r.check_group || "solo";
                  const att = attendees.find(a => a.id === r.attendee_id);
                  if (att) {
                    if (!teamMap.has(gid)) teamMap.set(gid, []);
                    teamMap.get(gid)!.push(att.name);
                  }
                });
                const dateObj = new Date(d);
                return {
                  date: d,
                  dayLabel: `${dayLabels[dateObj.getDay()]}(${dateObj.getMonth()+1}/${dateObj.getDate()})`,
                  teams: [...teamMap.entries()].map(([gid, names]) => ({ groupId: gid, names })),
                };
              });

              const attendedIds = new Set(
                attendanceRecords.filter(r => weekDates.includes(r.date) && r.present).map(r => r.attendee_id)
              );
              const filtered = lifeOnly ? attendees.filter(a => !a.is_member) : attendees;
              const notAttended = filtered.filter(a => !attendedIds.has(a.id));

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {dayGroups.map(dg => (
                      <div key={dg.date}>
                        <p className="text-xs font-semibold text-gray-600 mb-1">{dg.dayLabel}</p>
                        {dg.teams.length === 0 ? (
                          <div className="bg-gray-50 rounded-lg border border-gray-200 p-2">
                            <p className="text-[10px] text-gray-300 text-center">출석 없음</p>
                          </div>
                        ) : dg.teams.map((team, ti) => (
                          <div key={ti} className="bg-white rounded-lg border border-gray-200 p-2 mb-1">
                            {dg.teams.length > 1 && <p className="text-[10px] text-blue-500 font-medium mb-1">{ti+1}팀</p>}
                            {team.names.map(n => (
                              <p key={n} className="text-xs text-gray-700">{n}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  {notAttended.length > 0 && (
                    <div className="bg-red-50 rounded-lg border border-red-200 p-3">
                      <p className="text-xs font-medium text-red-600 mb-1">미참여 ({notAttended.length}명)</p>
                      <p className="text-xs text-red-500">{notAttended.map(a => a.name).join(", ")}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 원회원 명단 검색 */}
            {isWonMember && (
              <div className="relative">
                <input
                  type="text"
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder="이름·연락처·학과 검색"
                  className="w-full border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
                {detailSearch && (
                  <button onClick={() => setDetailSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
                )}
              </div>
            )}

            {/* Attendee list (기본 뷰) */}
            {!(event?.type === "club" && event?.club_unit === "weekly" && selectedSession !== "all" && selectedSession.startsWith("week_")) &&
            groupAttendees(isWonMember ? detailShown : attendees).map((group, gi) => (
              <div key={gi}>
                {group.label && <p className="text-xs font-semibold text-gray-500 mt-3 mb-1">{group.label}</p>}
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {group.items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">해당 항목이 없습니다.</p>
                  )}
                  {group.items.map((a) => {
                    const noShow = isNoShow(a.id, selectedDate);
                    // 원회원: 출석체크 없이 이름 클릭 → 상세정보 펼침(상세 탭과 동일)
                    if (isWonMember) {
                      const isExpanded = expandedAttendee === a.id;
                      return (
                        <div key={a.id} className="px-3 py-2.5">
                          <button onClick={() => setExpandedAttendee(isExpanded ? null : a.id)} className="w-full text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium shrink-0">{a.name}</span>
                              {a.gender && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                                  a.gender === "남" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                                }`}>{a.gender}</span>
                              )}
                              {a.memo && (
                                <span className="text-[11px] text-gray-400 truncate min-w-0" title={a.memo}>{a.memo}</span>
                              )}
                              <span className="ml-auto text-gray-300 text-xs shrink-0">{isExpanded ? "▲" : "▼"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              {a.year && <span>{formatYear(a.year)}</span>}
                              {a.school && <span>{a.school}</span>}
                              {a.department && <span>{a.department}</span>}
                            </div>
                          </button>
                          {isExpanded && renderWonExpanded(a)}
                        </div>
                      );
                    }
                    return (
                    <div key={a.id} className={`flex items-center px-3 py-2.5 ${noShow ? "opacity-40" : ""}`}>
                      {/* 원회원은 100% 출석자만 가입 → 노쇼 없음, 출석체크 박스 숨김 */}
                      {!isWonMember && (selectedSession.startsWith("week_") ? (
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-3 shrink-0 text-xs font-bold ${
                          isPresentForView(a.id) ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 text-gray-300"
                        }`}>
                          {getWeekDates(selectedSession).filter(d => isPresent(a.id, d)).length || ""}
                        </div>
                      ) : selectedSession === "all" && event?.type === "club" && event?.club_unit === "weekly" ? (
                        <div className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-3 shrink-0 text-xs font-bold ${
                          isPresentForView(a.id) ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 text-gray-300"
                        }`}>
                          {attendanceRecords.filter(r => r.attendee_id === a.id && r.present === true).length || ""}
                        </div>
                      ) : (
                      <button
                        onClick={() => toggleAttendance(a.id, selectedDate)}
                        title={noShow ? "노쇼 (다시 누르면 빈 칸)" : isPresent(a.id, selectedDate) ? "출석 (다시 누르면 노쇼)" : "체크 안 됨 (누르면 출석)"}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-3 shrink-0 transition-colors text-xs font-bold ${
                          isPresent(a.id, selectedDate)
                            ? "bg-blue-600 border-blue-600 text-white"
                            : noShow
                              ? "bg-gray-100 border-gray-300 text-gray-400"
                              : "border-gray-300 text-transparent"
                        }`}
                      >
                        {isPresent(a.id, selectedDate) ? "✓" : noShow ? "✕" : "✓"}
                      </button>
                      ))}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium shrink-0 whitespace-nowrap ${noShow ? "line-through text-gray-400" : ""}`}>{a.name}</span>
                          {a.gender && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                              a.gender === "남" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                            }`}>{a.gender}</span>
                          )}
                          {a.is_member && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">섭리</span>
                          )}
                          {noShow && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full shrink-0">노쇼</span>
                          )}
                          {a.memo && (
                            <span className="text-[11px] text-gray-400 truncate min-w-0 flex-1" title={a.memo}>{a.memo}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          {a.team && <span>{a.team}</span>}
                          {a.year && <span>{formatYear(a.year)}</span>}
                          {a.school && <span>{a.school}</span>}
                          {a.department && <span>{a.department}</span>}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== 상세 Tab ===== */}
        {activeTab === "detail" && (
          <div className="p-4 space-y-3">
            {/* 중복 의심 알림 (담당자 공통 — 한 명이 병합/스킵하면 전원 반영) */}
            {(() => {
              const nk = (s: string) => s.replace(/\s+/g, "").toLowerCase();
              const digits = (p: string | null) => (p || "").replace(/[^\d]/g, "");
              // 전화 '동일'은 실제 번호(9자리 이상)일 때만. 번호가 없거나 너무 짧으면 무시(오탐 방지).
              const usablePhone = (p: string | null) => digits(p).length >= 9;
              const skipped = new Set((settingsConfig.merge_skipped as string[] | undefined) || []);
              const pairKey = (x: string, y: string) => [x, y].sort().join("|");

              const dups: { a: Attendee; b: Attendee; reason: string; key: string }[] = [];
              for (let i = 0; i < attendees.length; i++) {
                for (let j = i + 1; j < attendees.length; j++) {
                  const a = attendees[i], b = attendees[j];
                  const key = pairKey(a.id, b.id);
                  if (skipped.has(key)) continue;
                  if (nk(a.name) && nk(a.name) === nk(b.name)) dups.push({ a, b, reason: "이름 동일", key });
                  else if (usablePhone(a.phone) && digits(a.phone) === digits(b.phone)) dups.push({ a, b, reason: "전화번호 동일", key });
                }
              }
              if (dups.length === 0) return null;
              return (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-2">중복 의심 ({dups.length}건)</p>
                  {dups.map((d) => (
                    <div key={d.key} className="flex items-center justify-between gap-2 text-xs text-yellow-700 py-1 border-t border-yellow-200 first:border-0">
                      <span className="min-w-0 flex-1 truncate">{d.a.name} ↔ {d.b.name} ({d.reason})</span>
                      <button onClick={async () => {
                        if (!confirm(`"${d.b.name}"을 삭제하고 "${d.a.name}"에 병합하시겠습니까?`)) return;
                        await supabase.from("event_attendance").delete().eq("attendee_id", d.b.id);
                        await supabase.from("event_attendees").delete().eq("id", d.b.id);
                        setAttendees(attendees.filter((x) => x.id !== d.b.id));
                      }} className="shrink-0 text-yellow-600 hover:text-red-500 font-medium">병합</button>
                      <button onClick={() => appendSharedConfigArray("merge_skipped", d.key)}
                        className="shrink-0 text-gray-400 hover:text-gray-600 font-medium">스킵</button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 친구 미신청 알림 — 같이 오는 친구 이름은 적혔는데 그 친구가 명단에 없음. 신청자에게 연락해 누락 방지. */}
            {(() => {
              const nk = (s: string) => s.replace(/\s+/g, "").toLowerCase();
              const nameSet = new Set(attendees.map((a) => nk(a.name)).filter(Boolean));
              // 조사(와/과/이랑 등)가 붙었으면 떼고 재시도 (친구별 그룹핑과 동일 규칙)
              const isRegistered = (tok: string) => {
                if (nameSet.has(tok)) return true;
                for (const cut of [1, 2]) { const t2 = tok.slice(0, tok.length - cut); if (t2.length >= 2 && nameSet.has(t2)) return true; }
                return false;
              };
              // 이름이 아닌 자유 텍스트는 친구로 취급하지 않음(오탐 방지)
              const stop = new Set(["없음", "없어요", "없습니다", "혼자", "미정", "모름", "몰라요", "없다", "x", "no", "none"]);
              const skipped = new Set((settingsConfig.friend_missing_skipped as string[] | undefined) || []);
              const seen = new Set<string>();
              const missing: { att: Attendee; friend: string; key: string }[] = [];
              for (const a of attendees) {
                const toks = (a.friend_group || "").split(/[,\n/·&+]|\s+/).map((t) => t.trim()).filter(Boolean);
                for (const raw of toks) {
                  const k = nk(raw);
                  if (k.length < 2 || k.length > 5 || stop.has(k) || isRegistered(k)) continue;
                  const key = `${a.id}|${k}`;
                  if (skipped.has(key) || seen.has(key)) continue;
                  seen.add(key);
                  missing.push({ att: a, friend: raw, key });
                }
              }
              if (missing.length === 0) return null;
              return (
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                  <p className="text-xs font-medium text-orange-800 mb-2">친구 미신청 ({missing.length}건) — 신청자에게 연락해 누락 방지</p>
                  {missing.map((m) => (
                    <div key={m.key} className="flex items-center justify-between gap-2 text-xs text-orange-700 py-1 border-t border-orange-200 first:border-0">
                      <span className="min-w-0 flex-1 truncate">
                        {m.att.name}{m.att.phone ? ` (${m.att.phone})` : ""} → {m.friend} <span className="text-orange-500 font-medium">(신청 안함)</span>
                      </span>
                      <button onClick={() => appendSharedConfigArray("friend_missing_skipped", m.key)}
                        className="shrink-0 text-gray-400 hover:text-gray-600 font-medium">확인</button>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Mode toggle (일회성만) */}
            {event?.type !== "club" && (
            <div className="flex bg-gray-200 rounded-lg p-0.5">
              <button
                onClick={() => setDetailMode("before")}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
                  detailMode === "before" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                }`}
              >
                행사 전
              </button>
              <button
                onClick={() => setDetailMode("after")}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${
                  detailMode === "after" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
                }`}
              >
                행사 후
              </button>
            </div>
            )}

            {/* 행사 후: 관리자에게 피드백 요청 (담당자들에게 알림 → 각자 피드백 페이지에서 작성) */}
            {detailMode === "after" && event?.type !== "club" && (
              <button
                onClick={async () => {
                  const hasMgr = attendees.some((a) => !a.is_member && a.manager_id);
                  if (!hasMgr) { alert("담당(관리자)으로 지정된 참석자가 없어요. 먼저 '행사 전'에서 담당을 배정해 주세요."); return; }
                  // 파악(assessment)이 아직 빈 참석자를 가진 담당자만 대상
                  const incompleteMgrs = new Set(attendees.filter((a) => !a.is_member && a.manager_id && !(a.assessment && a.assessment.trim())).map((a) => a.manager_id));
                  if (incompleteMgrs.size === 0) { alert("모든 담당자가 파악내용을 작성했어요. 보낼 사람이 없어요."); return; }
                  if (!confirm(`아직 파악내용이 안 채워진 담당자 ${incompleteMgrs.size}명에게 피드백 작성 요청을 보낼까요?`)) return;
                  setFeedbackReqSending(true);
                  try {
                    const res = await fetch("/api/notify-feedback-request", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ event_id: eventId }),
                    });
                    const d = await res.json();
                    if (d.allDone) alert("이미 모든 담당자가 피드백을 작성했어요. 추가로 보낼 사람이 없어요.");
                    else alert(`요청 완료: 아직 작성 안 한 담당자 ${d.managers ?? 0}명에게 알림을 보냈어요.`);
                  } catch { alert("요청 전송에 실패했어요."); }
                  setFeedbackReqSending(false);
                }}
                disabled={feedbackReqSending}
                className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
              >
                {feedbackReqSending ? "요청 보내는 중…" : "📝 관리자에게 피드백 요청 보내기"}
              </button>
            )}

            {/* Sort + Group (same as attendance + friend) */}
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {([["name", "이름순"], ["year", "학년순"], ["recent", "최신순"]] as [SortOption, string][]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setSortBy(val)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      sortBy === val ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {!isWonMember && (
                  <button
                    onClick={() => setLifeOnly(!lifeOnly)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ml-auto ${
                      lifeOnly ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    생명만
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["default", "기본"],
                  ["team", "팀별"],
                  ["manager", "관리자별"],
                  ["school", "학교별"],
                  ["attendance", "출석별"],
                  ["friend", "친구별"],
                  ...customGroupOptions.map((o) => [o.value, o.label] as [string, string]),
                ]).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setGroupBy(val)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      groupBy === val ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 사람 검색 */}
            <div className="relative">
              <input
                type="text"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                placeholder="이름·연락처·학과 검색"
                className="w-full border border-gray-200 rounded-lg pl-8 pr-8 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
              {detailSearch && (
                <button onClick={() => setDetailSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
              )}
            </div>

            {/* Attendee detail cards */}
            {detailSearch.trim() && detailShown.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">검색 결과가 없습니다.</p>
            )}
            {groupAttendees(detailShown).map((group, gi) => (
              <div key={gi}>
                {group.label && <p className="text-xs font-semibold text-gray-500 mt-3 mb-1">{group.label}</p>}
                <div className="space-y-2">
                  {group.items.map((a) => {
                    const isExpanded = expandedAttendee === a.id;
                    return (
                      <div key={a.id} className="bg-white rounded-lg border border-gray-200 p-3">
                        <button
                          onClick={() => {
                            if (event?.type === "club" && event?.club_unit === "weekly") {
                              router.push(`${basePath}/event/${eventId}/attendee/${a.id}`);
                            } else {
                              setExpandedAttendee(isExpanded ? null : a.id);
                            }
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{a.name}</span>
                            {/* 행사 후: 생명 전환 P(초록) / 미전환 F(빨강) — 게스트만 */}
                            {detailMode === "after" && !a.is_member && (
                              a.life_id
                                ? <span className="text-[10px] font-bold text-green-700 bg-green-100 rounded-full px-1.5 py-0.5">P</span>
                                : <span className="text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-1.5 py-0.5">F</span>
                            )}
                            {a.opposite_sex && detailMode === "after" && (
                              <span className="text-[10px] text-rose-500" title="이성 여부">♥</span>
                            )}
                            {a.gender && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                a.gender === "남" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                              }`}>
                                {a.gender}
                              </span>
                            )}
                            {a.is_member && (
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">섭리</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 flex-wrap">
                            {a.school && <span>{a.school}</span>}
                            {a.department && <span>{a.department}</span>}
                            {a.year && <span>{formatYear(a.year)}</span>}
                            {a.friend_group && <span>친구: {a.friend_group}</span>}
                            {a.memo && <span>{a.memo}</span>}
                          </div>
                        </button>

                        {/* Expanded: 읽기 전용 + 수정 토글 */}
                        {isExpanded && (() => {
                          const isEditing = editingAttendee === a.id;
                          return (
                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                            <div className="flex justify-end">
                              {isEditing ? (
                                <button onClick={(e) => { e.stopPropagation(); setEditingAttendee(null); }}
                                  className="text-[11px] bg-blue-600 text-white px-2.5 py-1 rounded-full">완료</button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); setEditingAttendee(a.id); }}
                                  className="text-[11px] text-blue-600 border border-blue-300 px-2.5 py-1 rounded-full hover:bg-blue-50">수정</button>
                              )}
                            </div>
                            {isEditing ? (
                              /* 편집 모드: 기존 인라인 입력 */
                              <div className="space-y-1.5">
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="text-[10px] text-gray-400">학교</span>
                                    <input type="text" value={a.school || ""} onChange={(e) => updateAttendeeField(a.id, "school", e.target.value || null)}
                                      placeholder="학교" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-gray-400">학과</span>
                                    <input type="text" value={a.department || ""} onChange={(e) => updateAttendeeField(a.id, "department", e.target.value || null)}
                                      placeholder="학과" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="text-[10px] text-gray-400">연락처</span>
                                    <input type="tel" value={a.phone || ""} onChange={(e) => updateAttendeeField(a.id, "phone", e.target.value || null)}
                                      placeholder="연락처" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                                  </div>
                                  <div></div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <span className="text-[10px] text-gray-400">성별</span>
                                    <select value={a.gender || ""} onChange={(e) => updateAttendeeField(a.id, "gender", e.target.value || null)}
                                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400">
                                      <option value="">미선택</option>
                                      <option value="남">남</option>
                                      <option value="여">여</option>
                                    </select>
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-gray-400">학년</span>
                                    <select value={a.year?.toString() || ""} onChange={(e) => updateAttendeeField(a.id, "year", e.target.value ? parseInt(e.target.value) : null)}
                                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400">
                                      <option value="">미선택</option>
                                      <option value="1">1학년</option>
                                      <option value="2">2학년</option>
                                      <option value="3">3학년</option>
                                      <option value="4">4학년</option>
                                      <option value="0">졸업유예</option>
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400">친구</span>
                                  <InlineInput value={a.friend_group || ""} onCommit={(v) => updateAttendeeField(a.id, "friend_group", v || null)}
                                    placeholder="함께 신청한 친구" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400">메모</span>
                                  <InlineTextarea value={a.memo || ""} onCommit={(v) => updateAttendeeField(a.id, "memo", v || null)}
                                    placeholder="메모 (예: 박수훈 연결)" rows={2}
                                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none focus:outline-none focus:border-blue-400" />
                                </div>
                                <div>
                                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                                    <input type="checkbox" checked={a.is_member} onChange={(e) => updateAttendeeField(a.id, "is_member", e.target.checked)}
                                      className="w-3.5 h-3.5" />
                                    섭리회원
                                  </label>
                                </div>
                                {a.custom_data && Object.entries(a.custom_data).map(([key]) => {
                                  const labelFromForm = regFields.find((f) => f.id === key)?.label;
                                  const displayLabel = labelFromForm || key;
                                  return (
                                    <div key={key}>
                                      <span className="text-[10px] text-gray-400">{displayLabel}</span>
                                      <InlineInput value={a.custom_data?.[key] || ""} onCommit={(v) => {
                                        const updated = { ...(a.custom_data || {}), [key]: v };
                                        updateAttendeeField(a.id, "custom_data", updated);
                                      }} placeholder={displayLabel} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              /* 읽기 전용: 신청폼 답변 전체 표시 */
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                                {a.phone && (<div><span className="text-gray-400 text-[10px]">연락처</span><p>{a.phone}</p></div>)}
                                {a.school && (<div><span className="text-gray-400 text-[10px]">학교</span><p>{a.school}</p></div>)}
                                {a.department && (<div><span className="text-gray-400 text-[10px]">학과</span><p>{a.department}</p></div>)}
                                {a.gender && (<div><span className="text-gray-400 text-[10px]">성별</span><p>{a.gender}</p></div>)}
                                {a.year != null && (<div><span className="text-gray-400 text-[10px]">학년</span><p>{formatYear(a.year)}</p></div>)}
                                {a.friend_group && (<div className="col-span-2"><span className="text-gray-400 text-[10px]">친구</span><p>{a.friend_group}</p></div>)}
                                {a.custom_data && Object.entries(a.custom_data).filter(([, v]) => v).map(([key, val]) => {
                                  const labelFromForm = regFields.find((f) => f.id === key)?.label;
                                  return (
                                    <div key={key} className="col-span-2"><span className="text-gray-400 text-[10px]">{labelFromForm || key}</span><p className="whitespace-pre-wrap">{val}</p></div>
                                  );
                                })}
                                {!a.phone && !a.school && !a.department && !a.gender && a.year == null && !a.friend_group && !(a.custom_data && Object.keys(a.custom_data).length > 0) && (
                                  <p className="col-span-2 text-gray-400">입력된 정보 없음</p>
                                )}
                              </div>
                            )}
                            {/* 펼치면 바로 편집: 메모 + 파악내용 (수정 버튼 없이 바로 수정) */}
                            {!isEditing && (
                              <div className="space-y-2">
                                <div>
                                  <span className="text-[10px] text-gray-400">메모</span>
                                  <InlineTextarea value={a.memo || ""} onCommit={(v) => updateAttendeeField(a.id, "memo", v || null)}
                                    placeholder="메모 (예: 박수훈 연결)" rows={2}
                                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-blue-400" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400">파악내용</span>
                                  <InlineTextarea value={a.assessment || ""} onCommit={(v) => updateAttendeeField(a.id, "assessment", v || null)}
                                    placeholder="특이사항·MBTI·본가·연애 여부 등" rows={3}
                                    className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-blue-400" />
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })()}

                        {/* Before mode: team + manager assignment */}
                        {(detailMode === "before" || event?.type === "club") && (
                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                            <div className="flex gap-2">
                              {/* 팀 배정: 러닝(주차별 동아리)은 팀출석으로 자동 관리되므로 숨김 */}
                              {!(event?.type === "club" && event?.club_unit === "weekly") && (
                              <select
                                value={a.team || ""}
                                onChange={(e) => updateAttendeeField(a.id, "team", e.target.value || null)}
                                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
                              >
                                <option value="">팀 미배정</option>
                                {(() => {
                                  const existingTeams = [...new Set(attendees.map(x => x.team).filter((t): t is string => !!t))].sort();
                                  const maxNum = existingTeams.reduce((max, t) => { const m = t.match(/^(\d+)팀$/); return m ? Math.max(max, parseInt(m[1])) : max; }, 0);
                                  const nextTeam = `${maxNum + 1}팀`;
                                  const allTeams = existingTeams.includes(nextTeam) ? existingTeams : [...existingTeams, nextTeam];
                                  return allTeams.map((t) => <option key={t} value={t}>{t}</option>);
                                })()}
                              </select>
                              )}
                              {!a.is_member && (
                              <ManagerAssign
                                attendee={a}
                                allUsers={allUsers}
                                members={members}
                                onAssign={(userId) => assignManager(a.id, userId)}
                                onCreate={(name) => createManagerAndAssign(a.id, name)}
                              />
                              )}
                            </div>
                          </div>
                        )}

                        {/* After mode: 파악내용 (특이사항·MBTI·작업여부 등) — 메모와 별개 컬럼(assessment) */}
                        {detailMode === "after" && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-gray-400">파악내용</span>
                              {(() => {
                                const mgrName = members.find((m) => m.user_id === a.manager_id)?.display_name
                                  || allUsers.find((u) => u.id === a.manager_id)?.display_name;
                                return mgrName
                                  ? <span className="text-[10px] font-semibold text-blue-600">담당 {mgrName}</span>
                                  : <span className="text-[10px] text-gray-300">담당 미배정</span>;
                              })()}
                            </div>
                            {/* 텍스트로만 표시 (수정은 사람 클릭 → 펼침 영역에서) */}
                            {a.assessment
                              ? <p className="text-xs text-gray-700 whitespace-pre-wrap">{a.assessment}</p>
                              : <p className="text-xs text-gray-300">아직 파악내용 없음 (이름을 눌러 입력)</p>}
                          </div>
                        )}

                        {/* 삭제 + 생명 전환 */}
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={async () => {
                              if (!confirm(`"${a.name}" 참가자를 삭제하시겠습니까?`)) return;
                              await supabase.from("event_attendance").delete().eq("attendee_id", a.id);
                              await supabase.from("event_attendees").delete().eq("id", a.id);
                              setAttendees(attendees.filter((x) => x.id !== a.id));
                            }}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            참가자 삭제
                          </button>
                          {/* 행사 전: 결제 상태 기록 버튼 (미입금→입금→환불 순환) */}
                          {detailMode === "before" && event?.type !== "club" && (() => {
                            const ps = a.payment_status;
                            const next = ps == null ? "입금" : ps === "입금" ? "환불" : null;
                            const label = ps == null ? "미입금" : ps;
                            const cls = ps === "입금"
                              ? "bg-green-100 text-green-700 border-green-300"
                              : ps === "환불"
                                ? "bg-orange-100 text-orange-700 border-orange-300"
                                : "bg-gray-100 text-gray-500 border-gray-300";
                            return (
                              <button
                                onClick={() => {
                                  updateAttendeeField(a.id, "payment_status", next);
                                }}
                                title="누르면 미입금 → 입금 → 환불 순으로 바뀝니다"
                                className={`text-xs font-medium border rounded-full px-3 py-1 ml-auto ${cls}`}
                              >
                                {label}
                              </button>
                            );
                          })()}

                          {/* 행사 후(일회성) / 동아리: 생명 전환 */}
                          {!a.is_member && (detailMode === "after" || event?.type === "club") && (
                            a.life_id ? (
                              <span className="text-xs text-green-600 font-medium ml-auto">생명 전환 완료</span>
                            ) : (
                              <button
                                onClick={async () => {
                                  const target = prompt("연결할 섭리회원 이름을 입력하세요\n" + members.map(m => m.display_name).join(", "));
                                  if (!target) return;
                                  const member = members.find(m => m.display_name === target.trim());
                                  if (!member) { alert("해당 섭리회원을 찾을 수 없습니다."); return; }
                                  try {
                                    // 만남 경위=행사명, 특징=파악내용(현재 입력 반영)
                                    const lifeId = await convertAttendeeToLife({
                                      attendee: a,
                                      primaryUserId: member.user_id,
                                      eventName: event?.name || "행사",
                                      assessment: a.assessment,
                                    });
                                    setAttendees(attendees.map(x => x.id === a.id ? { ...x, life_id: lifeId } : x));
                                  } catch (e) {
                                    alert("생명 등록 실패: " + (e instanceof Error ? e.message : ""));
                                  }
                                }}
                                className="text-xs text-blue-500 hover:text-blue-700 ml-auto"
                              >
                                생명 전환
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== 현황 Tab ===== */}
        {activeTab === "status" && (
          <div className="p-4 space-y-4">
            {/* AI button — 팝업 없이 백그라운드 실행. 완료되면 '분석 완료'로 바뀌고, 누르면 레포트 표시 */}
            {(() => {
              const st = eventReport?.status;
              const busy = st === "pending" || st === "processing";
              const done = st === "completed";
              const failed = st === "failed";
              const label = busy ? "AI 분석 중… (백그라운드)" : done ? "✓ 분석 완료 · 레포트 보기" : failed ? "분석 실패 · 다시 시도" : "AI 분석";
              const color = done
                ? "from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                : "from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700";
              return (
                <button
                  onClick={() => {
                    if (busy || done) setShowAiModal(true);
                    else startEventAnalysis(); // 없음/실패 → 새로 시작
                  }}
                  className={`w-full bg-gradient-to-r ${color} text-white rounded-lg py-2.5 text-sm font-medium transition-colors ${busy ? "animate-pulse" : ""}`}
                >
                  {label}
                </button>
              );
            })()}

            {/* Stats cards */}
            {(() => {
              const s = getStats();
              return (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-400">총 신청</p>
                    <p className="text-xl font-bold text-gray-800">{s.total}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-400">총 출석</p>
                    <p className="text-xl font-bold text-gray-800">{s.totalAttended}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-400">남 / 여</p>
                    <p className="text-xl font-bold text-gray-800">{s.male} / {s.female}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-400">생명 전환</p>
                    <p className="text-xl font-bold text-gray-800">{s.passed}</p>
                  </div>
                </div>
              );
            })()}

            {/* Bar charts — 학년·성별 + 신청폼 선택형 항목별 인원 (학과는 자유텍스트라 제외) */}
            {getChartFields().map((field) => {
              const { entries, max } = getChartData(field);
              return (
                <div key={field.key} className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    {field.label}별 인원
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-xs text-gray-400">데이터가 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {entries.map(([label, count]) => (
                        <button
                          key={label}
                          onClick={() => setChartPopup({ field, value: label })}
                          className="w-full flex items-center gap-2 hover:bg-gray-50 rounded px-1 -mx-1 py-0.5 transition-colors"
                          title={`${label} 명단 보기`}
                        >
                          <span className="text-xs text-gray-500 w-16 shrink-0 truncate text-left">{label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all"
                              style={{ width: `${(count / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-6 text-right">{count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Feedback form generation */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">피드백 수집</p>
                {!fbUrl ? (
                  <button onClick={() => setShowFeedbackGen(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">
                    피드백 생성
                  </button>
                ) : (
                  <button onClick={() => setShowFeedbackGen(true)} className="text-xs text-blue-600 border border-blue-300 px-3 py-1.5 rounded-lg hover:bg-blue-50">
                    수정
                  </button>
                )}
              </div>
              {fbUrl && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-blue-600 mb-1">피드백 URL</p>
                  <div className="flex gap-2">
                    <input value={fbUrl} readOnly className="flex-1 text-xs border border-blue-200 rounded px-2 py-1.5 bg-white" />
                    <button onClick={() => { navigator.clipboard.writeText(fbUrl); alert("복사되었습니다!"); }} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded">
                      복사
                    </button>
                  </div>
                </div>
              )}
              {feedbackResponses.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-gray-500">수집된 피드백 ({feedbackResponses.length}건)</p>
                  {feedbackResponses.map((r: any) => (
                    <div key={r.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50 flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {r.respondent_name && <p className="text-xs font-medium text-gray-700 mb-1">{r.respondent_name}</p>}
                        {Object.entries(r.answers as Record<string, string>).map(([q, a]) => (
                          a && <div key={q} className="mb-1">
                            <p className="text-[10px] text-gray-400">{q}</p>
                            <p className="text-xs text-gray-700">{a}</p>
                          </div>
                        ))}
                        <p className="text-[10px] text-gray-300 mt-1">{new Date(r.created_at).toLocaleDateString("ko-KR")}</p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!confirm("이 피드백을 삭제하시겠습니까?")) return;
                          await supabase.from("event_feedback_responses").delete().eq("id", r.id);
                          setFeedbackResponses(feedbackResponses.filter((x: any) => x.id !== r.id));
                        }}
                        className="text-gray-300 hover:text-red-400 text-xs px-1 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Direct feedback section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">섭리회원 피드백</p>
              <div className="space-y-2">
                {/* 관리자 피드백 페이지에서 쓴 애로사항·건의 */}
                {feedbackNotes.map((n) => (
                  <div key={n.id} className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-indigo-600">{n.name}</span>
                        <span className="text-[10px] text-gray-400">애로사항·건의</span>
                        {n.submitted_at && <span className="text-[10px] text-gray-300">{new Date(n.submitted_at).toLocaleDateString("ko-KR")}</span>}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.note}</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm(`${n.name} 님의 애로사항·건의를 삭제할까요?`)) return;
                        await supabase.from("event_feedback_requests").update({ note: null }).eq("id", n.id);
                        setFeedbackNotes((prev) => prev.filter((x) => x.id !== n.id));
                      }}
                      className="text-gray-300 hover:text-red-400 text-xs px-1 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {feedbacks.map((f) => (
                  <div key={f.id} className="flex items-start justify-between border-b border-gray-100 pb-2 last:border-0">
                    <div>
                      <p className="text-sm text-gray-800">{f.content}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(f.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm("이 피드백을 삭제하시겠습니까?")) return;
                        await supabase.from("event_feedback").delete().eq("id", f.id);
                        setFeedbacks(feedbacks.filter((x) => x.id !== f.id));
                      }}
                      className="text-gray-300 hover:text-red-400 text-xs px-1 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {feedbacks.length === 0 && feedbackNotes.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-2">피드백이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== 설정 Tab ===== */}
        {activeTab === "settings" && (
          <div className="p-4 space-y-4">
            {/* 내 행사 알림 (개인 설정) */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">행사 알림</p>
              <p className="text-xs text-gray-500 mb-3">이 행사에 신청이 들어오면 연결된 사람 전원에게 알림이 갑니다. 원치 않으면 아래에서 나만 끌 수 있어요.</p>
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
                <div>
                  <p className="text-sm text-gray-700">이 행사 신청 알림 받기</p>
                  <p className="text-xs text-gray-400">끄면 이 행사 신청 알림만 안 받습니다 (다른 행사는 영향 없음)</p>
                </div>
                <button
                  onClick={async () => {
                    const meId = getUser()?.id;
                    if (!meId) return;
                    const cur = (settingsConfig.notify_optout as string[] | undefined) || [];
                    // 현재 opt-out 상태면 → 받기로(제거), 아니면 → 안 받기로(추가)
                    const nextArr = notifyOptOut
                      ? cur.filter((id) => id !== meId)
                      : Array.from(new Set([...cur, meId]));
                    const nextConfig = { ...settingsConfig, notify_optout: nextArr };
                    const { data: existing } = await supabase.from("event_forms").select("id").eq("event_id", eventId).eq("type", "settings").limit(1);
                    if (existing && existing.length > 0) {
                      await supabase.from("event_forms").update({ config: nextConfig }).eq("id", existing[0].id);
                    } else {
                      await supabase.from("event_forms").insert({ event_id: eventId, type: "settings", config: nextConfig, created_by: meId });
                    }
                    setSettingsConfig(nextConfig);
                    setNotifyOptOut(!notifyOptOut);
                  }}
                  className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors shrink-0 ${
                    !notifyOptOut ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-300"
                  }`}
                >
                  {!notifyOptOut ? "받는 중 🔔" : "안 받음 🔕"}
                </button>
              </div>
            </div>

            {/* 연결된 담당자 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">연결된 담당자</p>
              <p className="text-xs text-gray-500 mb-3">연결된 사람은 자기 행사 목록에 이 행사가 보이고, 신청 알림을 받습니다.</p>
              {members.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {members.map((m) => (
                    <span key={m.id} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{m.display_name}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-3">아직 연결된 사람이 없습니다.</p>
              )}
              {showConnectSearch && (
                <div className="space-y-1 mb-2">
                  <input autoFocus value={connectSearch} onChange={(e) => setConnectSearch(e.target.value)}
                    placeholder="씨엔유 케어 사용자 이름 검색"
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                  {connectSearch.trim() && (() => {
                    const kw = connectSearch.trim();
                    const found = allUsers
                      .filter((u) => u.display_name.includes(kw) && !members.some((m) => m.user_id === u.id))
                      .slice(0, 20);
                    return found.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {found.map((u) => (
                          <button key={u.id} onClick={() => connectMember(u.id, u.display_name)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-blue-50">
                            {u.display_name} <span className="text-xs text-blue-500">연결</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 px-1">검색 결과가 없어요. (이미 연결됐거나 가입 전일 수 있어요)</p>
                    );
                  })()}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (!showConnectSearch) await loadAllUsers();
                    setShowConnectSearch(!showConnectSearch);
                    setConnectSearch("");
                  }}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium ${showConnectSearch ? "border border-gray-300 text-gray-500" : "bg-blue-600 text-white"}`}>
                  {showConnectSearch ? "검색 닫기" : "+ 담당자 연결"}
                </button>
                <button
                  onClick={async () => {
                    const nm = event?.name || "행사";
                    const msg = `[씨엔유 케어] '${nm}' 행사에 참가해 주세요!\n${publicBase()}\n로그인 후 [+ 행사 추가 → 기존 행사 참가]에서 "${nm}" 입력하면 연결됩니다.`;
                    await navigator.clipboard.writeText(msg);
                    alert("참가 안내가 복사되었습니다. 담당자에게 붙여넣어 보내세요.");
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm">참가 안내 복사</button>
              </div>
            </div>

            {/* 학교별 명단 공유 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">학교별 명단 공유</p>
              <p className="text-xs text-gray-500 mb-3">학교별로 개별 링크가 생성됩니다. 비밀번호를 입력해야 명단을 볼 수 있습니다.</p>
              {schoolShares.length === 0 ? (
                <button onClick={() => { setShareCreateMode("view"); setSharePwInput(""); setShowShareCreate(true); }}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">학교별 공유 링크 생성</button>
              ) : (
                <div className="space-y-2">
                  {SCHOOL_LIST.map((school) => {
                    const link = schoolShares.find((s) => s.school === school);
                    if (!link) return null;
                    const url = `${publicBase()}/event-share/${link.id}`;
                    return (
                      <div key={link.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-gray-700 w-20 shrink-0">{school}</span>
                        <input readOnly value={url} className="flex-1 text-[11px] text-gray-500 bg-transparent border-none focus:outline-none truncate" />
                        <button onClick={async () => { await navigator.clipboard.writeText(url); alert("복사되었습니다."); }}
                          className="text-[11px] text-blue-600 border border-blue-300 rounded-full px-2 py-1 hover:bg-blue-50 whitespace-nowrap">복사</button>
                      </div>
                    );
                  })}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShareCreateMode("view"); setSharePwInput(""); setShowShareCreate(true); }}
                      className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-xs font-medium hover:bg-gray-50">비번 변경 / 재생성</button>
                    <button onClick={async () => {
                      if (!confirm("학교별 공유 링크를 모두 삭제할까요?\n이후 기존 링크로는 접근할 수 없습니다.")) return;
                      await supabase.from("event_share_links").delete().eq("event_id", eventId).eq("mode", "view");
                      setSchoolShares([]);
                    }} className="flex-1 bg-red-50 text-red-600 rounded-lg py-2 text-xs font-medium">전체 삭제</button>
                  </div>
                </div>
              )}
              <button onClick={openRosterBySchool}
                className="w-full mt-2 border border-green-300 text-green-700 rounded-lg py-2 text-sm font-medium hover:bg-green-50">
                명단 보기 · 엑셀 다운 (학교별)
              </button>
            </div>

            {/* 전체 명단 공유 (학교 구분 없이 전부, 읽기 전용) */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">전체 명단 공유</p>
              <p className="text-xs text-gray-500 mb-3">학교 구분 없이 전체 신청자 명단을 볼 수 있는 링크입니다. 읽기 전용이며 비밀번호 필요.</p>
              {!allShare ? (
                <button onClick={() => { setShareCreateMode("all"); setSharePwInput(""); setShowShareCreate(true); }}
                  className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">전체 명단 링크 생성</button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                    <input readOnly value={`${publicBase()}/event-share/${allShare.id}`}
                      className="flex-1 text-[11px] text-gray-500 bg-transparent border-none focus:outline-none truncate" />
                    <button onClick={async () => { await navigator.clipboard.writeText(`${publicBase()}/event-share/${allShare.id}`); alert("복사되었습니다."); }}
                      className="text-[11px] text-blue-600 border border-blue-300 rounded-full px-2 py-1 hover:bg-blue-50 whitespace-nowrap">복사</button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setShareCreateMode("all"); setSharePwInput(""); setShowShareCreate(true); }}
                      className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-xs font-medium hover:bg-gray-50">비번 변경 / 재생성</button>
                    <button onClick={async () => {
                      if (!confirm("전체 명단 공유 링크를 삭제할까요?")) return;
                      await supabase.from("event_share_links").delete().eq("id", allShare.id);
                      setAllShare(null);
                    }} className="flex-1 bg-red-50 text-red-600 rounded-lg py-2 text-xs font-medium">삭제</button>
                  </div>
                </div>
              )}
              <button onClick={openRosterAll}
                className="w-full mt-2 border border-green-300 text-green-700 rounded-lg py-2 text-sm font-medium hover:bg-green-50">
                명단 보기 · 엑셀 다운 (전체)
              </button>
            </div>

            {/* 행사명 수정 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">행사 정보</p>
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-gray-400">행사명</span>
                  <input type="text" value={event?.name || ""} onChange={(e) => setEvent(event ? { ...event, name: e.target.value } : null)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400" />
                </div>
                <button onClick={async () => {
                  if (!event) return;
                  await supabase.from("events").update({ name: event.name }).eq("id", eventId);
                  alert("저장되었습니다.");
                }} className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium">행사명 저장</button>
              </div>
            </div>

            {/* 일회성 행사: 회차 없이 행사 날짜 하나만 */}
            {event?.type === "onetime" && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">행사 날짜</p>
              <input
                type="date"
                value={sessions[0]?.date || ""}
                onChange={(e) => setSessions(e.target.value ? [{ number: 1, date: e.target.value }] : [])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={async () => {
                  const nextSessions = sessions[0]?.date ? [{ number: 1, date: sessions[0].date }] : [];
                  const nextConfig = { ...settingsConfig, sessions: nextSessions };
                  const { data: existing } = await supabase.from("event_forms").select("id").eq("event_id", eventId).eq("type", "settings").limit(1);
                  if (existing && existing.length > 0) {
                    await supabase.from("event_forms").update({ config: nextConfig }).eq("id", existing[0].id);
                  } else {
                    await supabase.from("event_forms").insert({ event_id: eventId, type: "settings", config: nextConfig, created_by: getUser()?.id });
                  }
                  // 행사 목록 접두(yy.mm.dd 행사명)에 쓰이는 events.event_date 도 함께 갱신
                  await supabase.from("events").update({ event_date: sessions[0]?.date || null }).eq("id", eventId);
                  setSettingsConfig(nextConfig);
                  alert("저장되었습니다.");
                }}
                className="w-full mt-3 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium"
              >
                저장
              </button>
            </div>
            )}

            {/* 회차 설정 (동아리 · 회차당 집계 전용) */}
            {event?.type === "club" && event.club_unit !== "weekly" && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-3">회차 설정</p>
              <p className="text-xs text-gray-500 mb-3">각 회차 날짜를 입력하세요</p>
              <div className="space-y-2">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 w-16 shrink-0">{s.number}회차</span>
                    <input
                      type="date"
                      value={s.date}
                      onChange={(e) => {
                        const arr = [...sessions];
                        arr[i] = { ...arr[i], date: e.target.value };
                        setSessions(arr);
                      }}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={() => setSessions(sessions.filter((_, j) => j !== i).map((s, j) => ({ ...s, number: j + 1 })))}
                      className="text-gray-300 hover:text-red-400 text-sm px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setSessions([...sessions, { number: sessions.length + 1, date: new Date().toISOString().split("T")[0] }])}
                className="w-full mt-3 border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500"
              >
                + 회차 추가
              </button>
              <button
                onClick={async () => {
                  // settings 폼에 저장
                  const nextConfig = { ...settingsConfig, sessions };
                  const { data: existing } = await supabase.from("event_forms").select("id").eq("event_id", eventId).eq("type", "settings").limit(1);
                  if (existing && existing.length > 0) {
                    await supabase.from("event_forms").update({ config: nextConfig }).eq("id", existing[0].id);
                  } else {
                    await supabase.from("event_forms").insert({ event_id: eventId, type: "settings", config: nextConfig, created_by: getUser()?.id });
                  }
                  setSettingsConfig(nextConfig);
                  alert("저장되었습니다.");
                }}
                className="w-full mt-2 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium"
              >
                저장
              </button>
            </div>
            )}

            {/* 행사 삭제 */}
            <div className="bg-white rounded-lg border border-red-200 p-4">
              <p className="text-sm font-medium text-red-600 mb-2">행사 삭제</p>
              <p className="text-xs text-gray-500 mb-3">행사를 삭제하면 모든 참석자, 출석, 피드백 데이터가 영구 삭제됩니다.</p>
              <button onClick={async () => {
                if (!confirm(`"${event?.name}" 행사를 완전히 삭제하시겠습니까?\n모든 데이터가 삭제되며 복구할 수 없습니다.`)) return;
                await supabase.from("events").delete().eq("id", eventId);
                router.push(basePath);
              }} className="w-full bg-red-500 text-white rounded-lg py-2 text-sm font-medium">행사 삭제</button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Modals ===== */}

      {/* Registration form builder modal */}
      {showRegGen && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowRegGen(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">{regPreview ? "미리보기" : "신청폼 만들기"}</h3>
              <div className="flex gap-2">
                <button onClick={() => setRegPreview(!regPreview)} className="text-xs text-blue-600 hover:underline">
                  {regPreview ? "편집" : "미리보기"}
                </button>
                <button onClick={() => setShowRegGen(false)} className="text-xs text-gray-400">닫기</button>
              </div>
            </div>

            {regPreview ? (
              /* 미리보기 */
              <div className="space-y-3 border border-gray-200 rounded-lg p-4 bg-gray-50">
                {event?.poster_url && (
                  <img src={event.poster_url} alt="행사 포스터" className="w-full rounded-lg border border-gray-200" />
                )}
                {regDescription.trim() && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap border-b border-gray-200 pb-3">{regDescription}</p>
                )}
                {regFields.map((f) => (
                  <div key={f.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}{f.required && " *"}</label>
                    {f.description && (
                      <p className="text-xs text-gray-500 whitespace-pre-wrap mb-1">{f.description}</p>
                    )}
                    {f.type === "text" && <input disabled placeholder={f.label} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />}
                    {f.type === "textarea" && <textarea disabled placeholder={f.label} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />}
                    {f.type === "dropdown" && (
                      <select disabled className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                        <option>선택</option>
                        {f.options?.map(o => <option key={o}>{o}</option>)}
                      </select>
                    )}
                    {f.type === "checkbox" && (
                      <div className="flex flex-wrap gap-2">
                        {f.options?.map(o => (
                          <label key={o} className="flex items-center gap-1 text-sm text-gray-600">
                            <input type="checkbox" disabled /> {o}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* 편집 */
              <div className="space-y-3">
                {/* 포스터 */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <label className="text-xs text-gray-500 font-medium">포스터 (선택)</label>
                  <p className="text-[10px] text-gray-400">신청 페이지 맨 위에 표시되는 이미지입니다.</p>
                  {event?.poster_url ? (
                    <div className="space-y-2">
                      <img src={event.poster_url} alt="행사 포스터" className="w-full rounded-lg border border-gray-200" />
                      <div className="flex gap-2">
                        <label className={`flex-1 cursor-pointer border border-gray-300 text-gray-700 rounded-lg py-2 text-sm text-center bg-white hover:bg-gray-100 ${posterUploading ? "opacity-50 pointer-events-none" : ""}`}>
                          {posterUploading ? "업로드 중..." : "교체"}
                          <input type="file" accept="image/*" className="hidden" disabled={posterUploading} onChange={handlePosterUpload} />
                        </label>
                        <button disabled={posterUploading} onClick={handlePosterDelete}
                          className="flex-1 bg-red-50 text-red-600 rounded-lg py-2 text-sm disabled:opacity-50">삭제</button>
                      </div>
                    </div>
                  ) : (
                    <label className={`block w-full border-2 border-dashed border-gray-300 rounded-lg py-6 text-center text-sm cursor-pointer bg-white hover:border-blue-400 hover:text-blue-500 ${posterUploading ? "text-gray-400 pointer-events-none" : "text-gray-500"}`}>
                      {posterUploading ? "업로드 중..." : "+ 이미지 선택"}
                      <input type="file" accept="image/*" className="hidden" disabled={posterUploading} onChange={handlePosterUpload} />
                    </label>
                  )}
                </div>
                {/* 폼 설명 (소개글) */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <label className="text-xs text-gray-500 font-medium">폼 설명 (선택)</label>
                  <p className="text-[10px] text-gray-400">신청 페이지 상단에 표시되는 소개글. 줄바꿈 그대로 보입니다.</p>
                  <textarea value={regDescription} onChange={(e) => setRegDescription(e.target.value)}
                    placeholder="행사 안내, 유의사항 등을 입력하세요"
                    rows={4}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-y" />
                </div>
                {/* 필드 목록 */}
                {regFields.map((f, i) => (
                  <div key={f.id} className="bg-gray-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* 순서 이동 */}
                        <div className="flex flex-col">
                          <button onClick={() => { if (i === 0) return; const arr = [...regFields]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; setRegFields(arr); }}
                            className="text-gray-300 hover:text-gray-500 text-[10px] leading-none">▲</button>
                          <button onClick={() => { if (i === regFields.length - 1) return; const arr = [...regFields]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; setRegFields(arr); }}
                            className="text-gray-300 hover:text-gray-500 text-[10px] leading-none">▼</button>
                        </div>
                        <span className="text-sm font-medium">{f.label}</span>
                        <span className="text-[10px] text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
                          {f.type === "text" ? "텍스트" : f.type === "textarea" ? "긴 텍스트" : f.type === "dropdown" ? "드롭다운" : "체크박스"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] text-gray-500">
                          <input type="checkbox" checked={f.required}
                            onChange={(e) => { const arr = [...regFields]; arr[i] = { ...arr[i], required: e.target.checked }; setRegFields(arr); }}
                            className="w-3 h-3" />
                          필수
                        </label>
                        {f.id !== "name" && (
                          <button onClick={() => setRegFields(regFields.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                        )}
                      </div>
                    </div>
                    {/* 드롭다운/체크박스 옵션 편집 */}
                    {(f.type === "dropdown" || f.type === "checkbox") && (
                      <div>
                        <p className="text-[10px] text-gray-400 mb-1">옵션 (쉼표로 구분)</p>
                        <input value={f.options?.join(", ") || ""} onChange={(e) => {
                          const arr = [...regFields]; arr[i] = { ...arr[i], options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }; setRegFields(arr);
                        }} className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                      </div>
                    )}
                    {/* 부연설명 (선택) */}
                    <div>
                      <p className="text-[10px] text-gray-400 mb-1">부연설명 (선택)</p>
                      <textarea value={f.description || ""} onChange={(e) => {
                        const arr = [...regFields]; arr[i] = { ...arr[i], description: e.target.value }; setRegFields(arr);
                      }} placeholder="질문 아래에 표시될 안내문"
                        rows={2}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 resize-y" />
                    </div>
                  </div>
                ))}

                {/* 새 항목 추가 */}
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-gray-500 font-medium">항목 추가</p>
                  <input value={regNewLabel} onChange={(e) => setRegNewLabel(e.target.value)} placeholder="항목 이름"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  <div className="flex gap-2">
                    {(["text", "textarea", "dropdown", "checkbox"] as const).map(t => (
                      <button key={t} onClick={() => setRegNewType(t)}
                        className={`flex-1 text-[10px] py-1.5 rounded-lg border font-medium ${regNewType === t ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-500"}`}>
                        {t === "text" ? "텍스트" : t === "textarea" ? "긴 텍스트" : t === "dropdown" ? "드롭다운" : "체크박스"}
                      </button>
                    ))}
                  </div>
                  {(regNewType === "dropdown" || regNewType === "checkbox") && (
                    <input value={regNewOptions} onChange={(e) => setRegNewOptions(e.target.value)} placeholder="옵션 (쉼표로 구분)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                  )}
                  <textarea value={regNewDescription} onChange={(e) => setRegNewDescription(e.target.value)}
                    placeholder="부연설명 (선택) — 질문 아래에 표시될 안내문"
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-y" />
                  <button onClick={() => {
                    if (!regNewLabel.trim()) return;
                    const opts = regNewOptions.split(",").map(s => s.trim()).filter(Boolean);
                    const desc = regNewDescription.trim();
                    setRegFields([...regFields, {
                      id: `custom_${Date.now()}`, label: regNewLabel.trim(), type: regNewType, required: false,
                      ...(opts.length > 0 ? { options: opts } : {}),
                      ...(desc ? { description: desc } : {}),
                    }]);
                    setRegNewLabel(""); setRegNewOptions(""); setRegNewDescription("");
                  }} disabled={!regNewLabel.trim()}
                    className="w-full bg-gray-200 text-gray-700 rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                    + 추가
                  </button>
                </div>
              </div>
            )}

            <button onClick={async () => {
              if (regFormUrl) {
                // 수정: 기존 폼 업데이트
                const formId = regFormUrl.split("/register/")[1];
                await supabase.from("event_forms").update({ config: { fields: regFields, description: regDescription } }).eq("id", formId);
              } else {
                // 생성
                const { data } = await supabase.from("event_forms").insert({
                  event_id: eventId, type: "registration",
                  config: { fields: regFields, description: regDescription },
                  created_by: getUser()?.id,
                }).select("id").single();
                if (data) setRegFormUrl(`${publicBase()}/register/${data.id}`);
              }
              setShowRegGen(false);
            }} className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium mt-3">{regFormUrl ? "저장" : "생성하기"}</button>
          </div>
        </div>
      )}

      {/* Checkin form generation modal */}
      {showCheckinGen && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowCheckinGen(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">출석체크 생성</h3>
            <div className="flex bg-gray-200 rounded-lg p-0.5">
              <button onClick={() => setCheckinType("individual")}
                className={`flex-1 py-2 text-xs rounded-md font-medium ${checkinType === "individual" ? "bg-white shadow-sm" : "text-gray-500"}`}>
                개인 체크용
              </button>
              <button onClick={() => setCheckinType("team")}
                className={`flex-1 py-2 text-xs rounded-md font-medium ${checkinType === "team" ? "bg-white shadow-sm" : "text-gray-500"}`}>
                팀별 체크용
              </button>
            </div>

            {checkinType === "individual" && (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">출석 완료 팝업 문구 (선택)</p>
                  <input value={checkinPopupText} onChange={(e) => setCheckinPopupText(e.target.value)}
                    placeholder="예: 2번 테이블로 오세요!" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">팝업에 표시할 정보</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      const builtinOptions: [string, string][] = [
                        ["gender", "성별"], ["year", "학년"], ["department", "학과"], ["phone", "연락처"], ["friend_group", "친구"], ["team", "팀"],
                      ];
                      const activeBuiltins = builtinOptions.filter(([key]) =>
                        key === "team" || regFields.some(f => f.id === key)
                      );
                      const customOptions: [string, string][] = regFields
                        .filter(f => !f.builtin)
                        .map(f => [`custom_data.${f.label}`, f.label]);
                      return [...activeBuiltins, ...customOptions];
                    })().map(([key, label]) => (
                      <button key={key} onClick={() => setCheckinShowFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key])}
                        className={`text-xs px-3 py-1.5 rounded-full border ${checkinShowFields.includes(key) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {checkinType === "team" && (
              <p className="text-xs text-gray-500">이름 + 함께 띈 사람을 입력하는 팀별 출석 페이지가 생성됩니다.</p>
            )}

            <button onClick={async () => {
              if (checkinType === "individual") {
                if (checkinFormUrl && checkinFormUrl.includes("/checkin/")) {
                  // 수정
                  const formId = checkinFormUrl.split("/checkin/")[1];
                  await supabase.from("event_forms").update({ config: { popup_text: checkinPopupText, show_fields: checkinShowFields } }).eq("id", formId);
                } else {
                  // 생성
                  const { data } = await supabase.from("event_forms").insert({
                    event_id: eventId, type: "checkin_individual",
                    config: { popup_text: checkinPopupText, show_fields: checkinShowFields },
                    created_by: getUser()?.id,
                  }).select("id").single();
                  if (data) setCheckinFormUrl(`${publicBase()}/checkin/${data.id}`);
                }
              } else {
                // 팀별: slug 확인/생성
                let slug = event?.slug;
                if (!slug) {
                  slug = event?.name.replace(/\s+/g, "-").toLowerCase() + "-" + Date.now().toString(36);
                  await supabase.from("events").update({ slug }).eq("id", eventId);
                }
                await supabase.from("event_forms").upsert({
                  event_id: eventId, type: "checkin_team", config: {},
                  created_by: getUser()?.id,
                }, { onConflict: "event_id,type" });
                setCheckinFormUrl(`${publicBase()}/check/${encodeURIComponent(slug)}`);
              }
              setShowCheckinGen(false);
            }} className="w-full bg-orange-500 text-white rounded-lg py-2.5 text-sm font-medium">{checkinFormUrl ? "저장" : "생성하기"}</button>
          </div>
        </div>
      )}

      {/* Feedback generation modal */}
      {showFeedbackGen && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowFeedbackGen(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">{fbFormId ? "피드백 폼 수정" : "피드백 폼 생성"}</h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">익명 피드백</span>
              <button
                onClick={() => setFbAnonymous(!fbAnonymous)}
                className={`w-10 h-6 rounded-full transition-colors ${fbAnonymous ? "bg-blue-600" : "bg-gray-300"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${fbAnonymous ? "translate-x-4" : ""}`} />
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">질문 항목</p>
              <div className="space-y-2">
                {fbQuestions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{q}</span>
                    <button onClick={() => setFbQuestions(fbQuestions.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={fbNewQ}
                  onChange={(e) => setFbNewQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (fbNewQ.trim()) { setFbQuestions([...fbQuestions, fbNewQ.trim()]); setFbNewQ(""); } } }}
                  placeholder="질문 추가"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={() => { if (fbNewQ.trim()) { setFbQuestions([...fbQuestions, fbNewQ.trim()]); setFbNewQ(""); } }}
                  className="text-sm bg-gray-200 px-3 py-2 rounded-lg"
                >
                  추가
                </button>
              </div>
            </div>
            <button
              onClick={async () => {
                if (fbQuestions.length === 0) return;
                if (fbFormId) {
                  // 기존 폼 수정
                  await supabase.from("event_feedback_forms").update({ is_anonymous: fbAnonymous, questions: fbQuestions }).eq("id", fbFormId);
                } else {
                  const { data } = await supabase.from("event_feedback_forms").insert({
                    event_id: eventId,
                    is_anonymous: fbAnonymous,
                    questions: fbQuestions,
                    created_by: getUser()?.id,
                  }).select("id").single();
                  if (data) {
                    setFbFormId(data.id);
                    setFbUrl(`${publicBase()}/feedback/${data.id}`);
                  }
                }
                setShowFeedbackGen(false);
              }}
              disabled={fbQuestions.length === 0}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {fbFormId ? "저장" : "생성하기"}
            </button>
            {fbFormId && (
              <button
                onClick={async () => {
                  if (!confirm("피드백 폼을 삭제할까요?\n수집된 응답도 함께 삭제됩니다.")) return;
                  await supabase.from("event_feedback_responses").delete().eq("form_id", fbFormId);
                  await supabase.from("event_feedback_forms").delete().eq("id", fbFormId);
                  setFbFormId(null);
                  setFbUrl("");
                  setFeedbackResponses([]);
                  setShowFeedbackGen(false);
                }}
                className="w-full mt-2 border border-red-200 text-red-500 rounded-lg py-2.5 text-sm font-medium hover:bg-red-50"
              >
                피드백 폼 삭제
              </button>
            )}
          </div>
        </div>
      )}

      {/* 명단 공유 링크 생성/재생성 비번 모달 */}
      {showShareCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowShareCreate(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {shareCreateMode === "view"
                  ? (schoolShares.length > 0 ? "학교별 비번 변경 / 재생성" : "학교별 공유 링크 생성")
                  : (allShare ? "전체 명단 비번 변경 / 재생성" : "전체 명단 공유 링크 생성")}
              </h3>
              <button onClick={() => setShowShareCreate(false)} className="text-xs text-gray-400">닫기</button>
            </div>
            <p className="text-xs text-gray-500">
              {shareCreateMode === "view"
                ? "외부 학교 담당자에게 공유할 비밀번호 4자리를 정해주세요. 학교별 7개 링크 모두 같은 비번을 사용합니다."
                : "전체 명단을 볼 사람과 공유할 비밀번호 4자리를 정해주세요."}
            </p>
            <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} value={sharePwInput}
              onChange={(e) => setSharePwInput(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="4자리 숫자"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 text-center tracking-widest" />
            <button disabled={sharePwInput.length !== 4}
              onClick={async () => {
                if (shareCreateMode === "view") {
                  await supabase.from("event_share_links").delete().eq("event_id", eventId).eq("mode", "view");
                  const rows = SCHOOL_LIST.map((school) => ({ event_id: eventId, school, password: sharePwInput, mode: "view" }));
                  const { data, error } = await supabase.from("event_share_links").insert(rows).select("id, school");
                  if (error) { alert("생성 실패: " + error.message); return; }
                  if (data) setSchoolShares(data as { id: string; school: string }[]);
                } else {
                  await supabase.from("event_share_links").delete().eq("event_id", eventId).eq("mode", "all");
                  const { data, error } = await supabase.from("event_share_links")
                    .insert({ event_id: eventId, school: null, password: sharePwInput, mode: "all" })
                    .select("id").single();
                  if (error) { alert("생성 실패: " + error.message); return; }
                  if (data) setAllShare({ id: (data as any).id });
                }
                setShowShareCreate(false);
              }}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50">
              생성
            </button>
          </div>
        </div>
      )}

      {/* Add attendee modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">참석자 추가</h3>
              <button onClick={() => setShowAddModal(false)} className="text-xs text-gray-400">닫기</button>
            </div>

            {/* 파일로 명단 추가 (이미지·엑셀) — 새 행사 등록과 동일한 큰 버튼 */}
            <label className={`block mb-3 cursor-pointer ${rosterUploading ? "opacity-60 pointer-events-none" : ""}`}>
              <input
                type="file"
                accept="image/*,.xlsx,.xls,.csv,.tsv"
                multiple
                className="hidden"
                onChange={(e) => { handleRosterUpload(e.target.files); e.target.value = ""; }}
              />
              <div className="w-full border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-center text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
                {rosterUploading ? "명단 처리 중…" : "📎 이미지·엑셀로 명단 불러오기"}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">캡처 이미지나 엑셀/CSV를 올리면 이름·연락처를 자동 추출해 참석자로 넣어요.</p>
            </label>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[11px] text-gray-400">또는 직접 입력</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            {/* 섭리/게스트 분기 */}
            <div className="flex bg-gray-100 rounded-lg p-0.5 mb-3">
              <button onClick={() => setAddType("guest")}
                className={`flex-1 py-1.5 text-xs rounded-md font-medium ${addType === "guest" ? "bg-white shadow-sm" : "text-gray-500"}`}>
                게스트
              </button>
              <button onClick={() => setAddType("member")}
                className={`flex-1 py-1.5 text-xs rounded-md font-medium ${addType === "member" ? "bg-white shadow-sm" : "text-gray-500"}`}>
                섭리회원
              </button>
            </div>
            {addType === "member" ? (
              <div className="space-y-2">
                <input type="text" value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="이름 검색" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto divide-y divide-gray-100">
                  {allUsers
                    .filter((u) => !memberSearch.trim() || u.display_name.includes(memberSearch.trim()))
                    .map((u) => {
                      const already = attendees.some((a) => a.name === u.display_name);
                      return (
                        <button key={u.id} disabled={already}
                          onClick={() => addMemberAttendee(u.display_name)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${already ? "text-gray-300" : "hover:bg-blue-50"}`}>
                          <span>{u.display_name}</span>
                          {already && <span className="text-[10px] text-gray-400">이미 명단</span>}
                        </button>
                      );
                    })}
                  {allUsers.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-3">사용자 목록을 불러오는 중...</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input type="text" value={newAttendeeName} onChange={(e) => setNewAttendeeName(e.target.value)}
                  placeholder="이름 *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={newAttendeeGender} onChange={(e) => setNewAttendeeGender(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    <option value="">성별</option>
                    <option value="남">남</option>
                    <option value="여">여</option>
                  </select>
                  <select value={newAttendeeYear} onChange={(e) => setNewAttendeeYear(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400">
                    <option value="">학년</option>
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                    <option value="4">4학년</option>
                    <option value="0">졸업유예</option>
                  </select>
                </div>
                <input type="text" value={newAttendeeSchool} onChange={(e) => setNewAttendeeSchool(e.target.value)}
                  placeholder="학교" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <input type="text" value={newAttendeeDept} onChange={(e) => setNewAttendeeDept(e.target.value)}
                  placeholder="학과" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <input type="tel" value={newAttendeePhone} onChange={(e) => setNewAttendeePhone(e.target.value)}
                  placeholder="연락처" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <input type="text" value={newAttendeeFriend} onChange={(e) => setNewAttendeeFriend(e.target.value)}
                  placeholder="함께 신청한 친구 (쉼표로 구분)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                <button onClick={addAttendee} disabled={!newAttendeeName.trim()}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  추가
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 그래프 막대 클릭 → 해당 항목 명단 팝업 */}
      {chartPopup && (() => {
        const list = getChartMembers(chartPopup.field, chartPopup.value);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setChartPopup(null)}>
            <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">
                  {chartPopup.field.label} · {chartPopup.value}
                  <span className="text-gray-400 font-normal ml-1">{list.length}명</span>
                </h3>
                <button onClick={() => setChartPopup(null)} className="text-xs text-gray-400">닫기</button>
              </div>
              {list.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">해당하는 사람이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {list.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2">
                      <span className="text-sm font-medium">{a.name}</span>
                      {a.gender && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.gender === "남" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>{a.gender}</span>
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                        {a.year != null && <span>{formatYear(a.year)}</span>}
                        {a.department && <span>{a.department}</span>}
                        {a.phone && <span>{a.phone}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Excel upload modal */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => { setShowExcelModal(false); setExcelPreview([]); setExcelHeaders([]); }}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">엑셀/CSV 업로드</h3>
              <button onClick={() => { setShowExcelModal(false); setExcelPreview([]); setExcelHeaders([]); }} className="text-xs text-gray-400">닫기</button>
            </div>

            {excelPreview.length === 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">엑셀(.xlsx) 또는 CSV(.csv) 파일을 선택하세요. 첫 번째 행은 헤더로 인식됩니다.</p>
                <a href="/참석자_양식.xlsx" download className="text-xs text-blue-600 hover:underline">양식 다운로드</a>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    let headers: string[] = [];
                    let rows: Record<string, string>[] = [];

                    const ext = file.name.split(".").pop()?.toLowerCase();

                    if (ext === "xlsx" || ext === "xls") {
                      // 엑셀 파싱
                      const buffer = await file.arrayBuffer();
                      const wb = XLSX.read(buffer, { type: "array" });
                      const ws = wb.Sheets[wb.SheetNames[0]];
                      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
                      if (jsonData.length === 0) { alert("데이터가 없습니다."); return; }
                      headers = Object.keys(jsonData[0]);
                      rows = jsonData.map(r => {
                        const row: Record<string, string> = {};
                        headers.forEach(h => { row[h] = String(r[h] ?? "").trim(); });
                        return row;
                      });
                    } else {
                      // CSV 파싱
                      const text = await file.text();
                      const delimiter = text.includes("\t") ? "\t" : ",";
                      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
                      if (lines.length < 2) { alert("데이터가 없습니다."); return; }
                      headers = lines[0].split(delimiter).map(h => h.replace(/"/g, "").trim());
                      rows = lines.slice(1).map(line => {
                        const cols = line.split(delimiter).map(c => c.replace(/"/g, "").trim());
                        const row: Record<string, string> = {};
                        headers.forEach((h, i) => { row[h] = cols[i] || ""; });
                        return row;
                      });
                    }

                    rows = rows.filter(row => Object.values(row).some(v => v));

                    setExcelHeaders(headers);
                    setExcelPreview(rows);

                    // 자동 매핑 추측
                    const autoMap: Record<string, string> = {};
                    const fieldGuess: Record<string, string[]> = {
                      name: ["이름", "name", "성명"],
                      gender: ["성별", "gender"],
                      department: ["학과", "department", "전공"],
                      year: ["학년", "학번", "year", "grade"],
                      phone: ["전화", "연락처", "phone", "핸드폰", "휴대폰"],
                      friend_group: ["친구", "함께", "friend"],
                      memo: ["메모", "비고", "memo", "note"],
                    };
                    headers.forEach(h => {
                      const lower = h.toLowerCase();
                      for (const [field, guesses] of Object.entries(fieldGuess)) {
                        if (guesses.some(g => lower.includes(g))) {
                          autoMap[h] = field;
                          break;
                        }
                      }
                    });
                    setExcelMapping(autoMap);
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* 컬럼 매핑 */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">컬럼 매핑 (엑셀 헤더 → 필드)</p>
                  <div className="space-y-1.5">
                    {excelHeaders.map(h => (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-24 truncate shrink-0">{h}</span>
                        <span className="text-xs text-gray-400">→</span>
                        <select
                          value={excelMapping[h] || ""}
                          onChange={(e) => setExcelMapping(prev => ({ ...prev, [h]: e.target.value }))}
                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5"
                        >
                          <option value="">무시</option>
                          <option value="name">이름</option>
                          <option value="gender">성별</option>
                          <option value="department">학과</option>
                          <option value="year">학년</option>
                          <option value="phone">연락처</option>
                          <option value="friend_group">친구</option>
                          <option value="memo">메모</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 미리보기 */}
                <div>
                  <p className="text-xs text-gray-500 mb-1">미리보기 ({excelPreview.length}명)</p>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    {excelPreview.slice(0, 10).map((row, i) => {
                      const nameCol = Object.entries(excelMapping).find(([, v]) => v === "name")?.[0];
                      const deptCol = Object.entries(excelMapping).find(([, v]) => v === "department")?.[0];
                      return (
                        <div key={i} className="px-3 py-1.5 text-xs border-b border-gray-100 last:border-0">
                          <span className="font-medium">{nameCol ? row[nameCol] : "이름 미매핑"}</span>
                          {deptCol && row[deptCol] && <span className="text-gray-400 ml-2">{row[deptCol]}</span>}
                        </div>
                      );
                    })}
                    {excelPreview.length > 10 && <p className="text-[10px] text-gray-400 text-center py-1">... 외 {excelPreview.length - 10}명</p>}
                  </div>
                </div>

                {/* 업로드 */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setExcelPreview([]); setExcelHeaders([]); setExcelMapping({}); }}
                    className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-2.5 text-sm"
                  >
                    다시 선택
                  </button>
                  <button
                    disabled={!Object.values(excelMapping).includes("name") || excelUploading}
                    onClick={async () => {
                      setExcelUploading(true);
                      const yearMap: Record<string, number> = { "1학년": 1, "2학년": 2, "3학년": 3, "4학년": 4, "졸업유예": 0 };
                      let added = 0, skipped = 0;

                      for (const row of excelPreview) {
                        const mapped: Record<string, any> = { event_id: eventId, is_member: false, status: "pending" };

                        for (const [header, field] of Object.entries(excelMapping)) {
                          if (!field || !row[header]) continue;
                          if (field === "year") {
                            const val = row[header].trim();
                            mapped.year = yearMap[val] ?? (parseInt(val) || null);
                          } else {
                            mapped[field] = row[header].trim();
                          }
                        }

                        if (!mapped.name) { skipped++; continue; }

                        // 섭리회원 자동 판별
                        const { data: matchedUser } = await supabase
                          .from("users").select("id").eq("display_name", mapped.name).limit(1);
                        if (matchedUser && matchedUser.length > 0) mapped.is_member = true;

                        const { error } = await supabase.from("event_attendees").upsert(mapped, { onConflict: "event_id,name" });
                        if (!error) added++; else skipped++;
                      }

                      alert(`${added}명 추가, ${skipped}명 스킵`);
                      setShowExcelModal(false);
                      setExcelPreview([]);
                      setExcelHeaders([]);
                      setExcelMapping({});
                      setExcelUploading(false);
                      // 참석자 목록 새로고침
                      const { data: refreshed } = await supabase.from("event_attendees").select("*").eq("event_id", eventId).order("name");
                      if (refreshed) setAttendees(refreshed as Attendee[]);
                    }}
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
                  >
                    {excelUploading ? "추가 중..." : `${excelPreview.length}명 추가`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance rate modal (club) */}
      {showRateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowRateModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">출석률</h3>
              <button onClick={() => setShowRateModal(false)} className="text-xs text-gray-400">닫기</button>
            </div>
            <div className="space-y-2">
              {getAttendanceRates().map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm w-16 shrink-0 truncate">{r.name}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className="bg-green-500 h-full rounded-full transition-all"
                      style={{ width: `${r.rate}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-20 text-right shrink-0">
                    {r.attended}/{r.total} ({r.rate}%)
                  </span>
                </div>
              ))}
              {getAttendanceRates().length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">출석 기록이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI analysis modal — 완료된 레포트 표시 + 레포트 커스텀(재분석) */}
      {showAiModal && (() => {
        const st = eventReport?.status;
        const busy = !eventReport || st === "pending" || st === "processing";
        const failed = st === "failed";
        return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowAiModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">행사 AI 분석</h3>
              <button onClick={() => setShowAiModal(false)} className="text-xs text-gray-400">닫기</button>
            </div>
            {busy ? (
              <div className="py-10 text-center space-y-2">
                <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600">AI가 이 행사를 분석하고 있어요…</p>
                <p className="text-xs text-gray-400">참가자 분포·생명 전환·피드백 종합 (최대 1~2분) · 닫아도 백그라운드에서 계속됩니다</p>
              </div>
            ) : failed ? (
              <div className="space-y-3">
                <p className="text-sm text-red-500">분석에 실패했어요.</p>
                <button onClick={() => { setShowAiModal(false); startEventAnalysis(); }}
                  className="w-full border border-gray-200 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50">다시 분석</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: extractHtml(eventReport?.content || "") }} />

                {/* 레포트 커스텀 */}
                {!aiCustomOpen ? (
                  <div className="flex gap-2">
                    <button onClick={() => setAiCustomOpen(true)}
                      className="flex-1 border border-indigo-300 text-indigo-600 rounded-lg py-2 text-sm font-medium hover:bg-indigo-50">
                      레포트 커스텀
                    </button>
                    <button onClick={() => { setShowAiModal(false); startEventAnalysis(); }}
                      className="border border-gray-200 text-gray-500 rounded-lg py-2 px-3 text-sm hover:bg-gray-50">
                      새로 분석
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 border border-indigo-200 rounded-lg p-3 bg-indigo-50/40">
                    <p className="text-xs text-gray-600">더 깊게 보고 싶은 부분을 적어주세요. 그 방향으로 다시 분석해요.</p>
                    <textarea
                      value={aiCustomText}
                      onChange={(e) => setAiCustomText(e.target.value)}
                      rows={3}
                      placeholder="예: 1학년 유입 경로를 신청폼 항목별로 더 자세히 분석하고, 다음 행사 홍보 채널을 구체적으로 제안해줘"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                    />
                    <div className="flex gap-2">
                      <button onClick={runAiCustom} disabled={!aiCustomText.trim()}
                        className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50">
                        이 방향으로 재분석
                      </button>
                      <button onClick={() => { setAiCustomOpen(false); setAiCustomText(""); }}
                        className="border border-gray-200 text-gray-500 rounded-lg py-2 px-3 text-sm hover:bg-gray-50">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* 중복 의심자 상세 팝업 — 어떤 행사들이 겹치는지 보고 판단 */}
      {dupDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setDupDetail(null)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-base font-bold text-gray-900">{dupDetail.name}</span>
                {dupDetail.matchType === "phone"
                  ? <span className="ml-1.5 text-[11px] font-bold text-red-600">중복 확정</span>
                  : <span className="ml-1.5 text-[11px] font-bold text-amber-600">의심</span>}
                {dupDetail.isLife && <span className="ml-1.5 text-[11px] font-bold text-rose-600">생명</span>}
                <p className="text-xs text-gray-400">{dupDetail.matchType === "phone" ? "이름+번호까지 일치 — 같은 사람" : "이름만 일치 — 동명이인일 수 있음"}</p>
              </div>
              <button onClick={() => setDupDetail(null)} className="text-gray-400 text-xl leading-none px-1">&times;</button>
            </div>

            <div className="p-4 space-y-4">
              {dupDetail.isLife && (
                <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2">
                  <p className="text-sm font-semibold text-rose-700">이미 우리 생명</p>
                  <p className="text-xs text-rose-500 mt-0.5">말씀을 전하거나 듣고 있는 사람{dupDetail.lifeManager ? ` · 담당 전도자 ${dupDetail.lifeManager}` : ""}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5">CNU 행사 참여 {dupDetail.cnuEvents.length}건</p>
                {dupDetail.cnuEvents.length === 0 ? (
                  <p className="text-xs text-gray-400">없음</p>
                ) : (
                  <div className="space-y-1.5">
                    {dupDetail.cnuEvents.map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-150 bg-gray-50 px-3 py-2">
                        <span className="text-sm font-medium text-gray-800 min-w-0 truncate">{e.eventName}</span>
                        <span className="shrink-0 text-[11px] text-gray-500">{e.how}{e.status ? ` · ${e.status}` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5">프로젠 참여 {dupDetail.progenEvents.length}건</p>
                {dupDetail.progenEvents.length === 0 ? (
                  <p className="text-xs text-gray-400">없음</p>
                ) : (
                  <div className="space-y-1.5">
                    {dupDetail.progenEvents.map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-gray-150 bg-gray-50 px-3 py-2">
                        <span className="text-sm font-medium text-gray-800 min-w-0 truncate">{e.event}</span>
                        <span className="shrink-0 text-[11px] text-gray-500">{e.kind}{e.date ? ` · ${e.date}` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 p-3 flex gap-2">
              <button onClick={() => setDupDetail(null)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600">닫기</button>
              <button
                onClick={async () => { const id = dupDetail.attendeeId; setDupDetail(null); await confirmDup(id); }}
                className="flex-1 py-2.5 rounded-lg bg-amber-600 text-white text-sm font-semibold"
              >
                확인 완료 (배너에서 제거)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 명단 미리보기 모달 — 표 확인 후 엑셀 다운 / 구글 시트용 복사 */}
      {roster && (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col" onClick={closeRoster}>
          <div className="bg-white w-full sm:max-w-5xl sm:mx-auto sm:my-6 sm:rounded-xl mt-auto h-[92vh] sm:h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{roster.title}</p>
                <p className="text-xs text-gray-500">{roster.total}명{roster.multi ? ` · ${roster.sections.length}개 시트` : ""}</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <a href={roster.xlsxUrl} download={roster.fileName}
                  className="text-xs bg-green-600 text-white rounded-lg px-3 py-2 font-medium whitespace-nowrap">엑셀 다운로드</a>
                <button onClick={copyRosterTsv}
                  className="text-xs bg-blue-600 text-white rounded-lg px-3 py-2 font-medium whitespace-nowrap">{rosterCopied ? "복사됨 ✓" : "구글 시트용 복사"}</button>
                <button onClick={closeRoster} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">✕</button>
              </div>
            </div>
            <div className="px-4 py-1.5 text-[11px] text-gray-500 border-b border-gray-100">
              {roster.multi
                ? "엑셀은 학교별로 시트(탭)가 분리됩니다. ‘구글 시트용 복사’는 학교 컬럼이 포함된 한 표로 붙습니다. "
                : "‘구글 시트용 복사’ 후 빈 구글 시트에 붙여넣기(⌘/Ctrl+V)하면 표로 들어갑니다. "}
              <a href="https://sheets.new" target="_blank" rel="noopener" className="text-blue-600 underline">빈 시트 열기</a>
            </div>
            <div className="flex-1 overflow-auto px-4 pb-6">
              {roster.sections.map((s, si) => (
                <div key={si} className="mt-3">
                  {roster.multi && (
                    <p className="text-sm font-semibold text-gray-700 mb-1">{s.name} <span className="text-xs font-normal text-gray-400">{s.rows.length}명</span></p>
                  )}
                  <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="text-xs border-collapse w-full">
                      <thead>
                        <tr>
                          <th className="bg-gray-100 border border-gray-200 px-2 py-1.5 text-right text-gray-400 font-medium">#</th>
                          {roster.cols.map((c) => (
                            <th key={c} className="bg-gray-100 border border-gray-200 px-2 py-1.5 text-left font-semibold whitespace-nowrap">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.rows.map((r, i) => (
                          <tr key={i}>
                            <td className="border border-gray-200 px-2 py-1.5 text-right text-gray-400">{i + 1}</td>
                            {roster.cols.map((c) => (
                              <td key={c} className="border border-gray-200 px-2 py-1.5 whitespace-nowrap">{r[c] ?? ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 담당 관리자 배정 콤보박스 — 이 행사에 연결된 사람만이 아니라 CNUcare 전체 관리자를 검색해 배정.
// 검색 결과에 없는 이름이면 "씨엔유 케어에 없습니다. 관리자로 추가할까요?" 안내 후 이름만으로 추가.
function ManagerAssign({
  attendee, allUsers, members, onAssign, onCreate,
}: {
  attendee: Attendee;
  allUsers: { id: string; display_name: string }[];
  members: Member[];
  onAssign: (userId: string | null) => void | Promise<void>;
  onCreate: (name: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const curName =
    allUsers.find((u) => u.id === attendee.manager_id)?.display_name ||
    members.find((m) => m.user_id === attendee.manager_id)?.display_name ||
    "";
  const kw = q.trim();
  const filtered = allUsers.filter((u) => !kw || u.display_name.includes(kw));
  const exactExists = allUsers.some((u) => u.display_name === kw);

  const close = () => { setOpen(false); setQ(""); };
  const pick = async (userId: string | null) => {
    setBusy(true);
    try { await onAssign(userId); } finally { setBusy(false); close(); }
  };
  const create = async () => {
    setBusy(true);
    try { await onCreate(kw); } finally { setBusy(false); close(); }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex-1 text-xs text-left border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
      >
        {curName ? <span className="text-gray-900">{curName}</span> : <span className="text-gray-400">관리자 미배정</span>}
      </button>
    );
  }

  return (
    <div className="flex-1 relative">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="관리자 이름 검색"
        className="w-full text-xs border border-blue-400 rounded px-2 py-1.5 focus:outline-none"
      />
      <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
        <button
          type="button"
          onClick={() => pick(null)}
          disabled={busy}
          className="w-full text-left px-2.5 py-1.5 text-xs text-gray-400 hover:bg-gray-50"
        >
          관리자 미배정
        </button>
        {filtered.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => pick(u.id)}
            disabled={busy}
            className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 flex items-center justify-between"
          >
            <span>{u.display_name}</span>
            {u.id === attendee.manager_id && <span className="text-[10px] text-blue-500">현재</span>}
          </button>
        ))}
        {kw && !exactExists && (
          <div className="px-2.5 py-2 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mb-1">&quot;{kw}&quot;은(는) 씨엔유 케어에 없습니다. 관리자로 추가할까요?</p>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="w-full bg-blue-600 text-white rounded px-2 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {busy ? "추가 중..." : `"${kw}" 관리자로 추가`}
            </button>
          </div>
        )}
        {!kw && allUsers.length === 0 && (
          <p className="px-2.5 py-2 text-[11px] text-gray-400">사용자 목록을 불러오는 중...</p>
        )}
        <button type="button" onClick={close} className="w-full text-left px-2.5 py-1.5 text-[11px] text-gray-400 border-t border-gray-100 hover:bg-gray-50">
          닫기
        </button>
      </div>
    </div>
  );
}
