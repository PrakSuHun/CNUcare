"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import * as XLSX from "xlsx";

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
  is_member: boolean;
  life_id: string | null;
  custom_data: Record<string, string> | null;
}

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
type SortOption = "name" | "year" | "department";
type GroupOption = string; // "default" | "team" | "manager" | "lifeOnly" | "attendance" | "friend" | "custom_xxx"

export default function EventDetail({ eventId, basePath }: EventDetailProps) {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [posterUploading, setPosterUploading] = useState(false);
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
  const [expandedAttendee, setExpandedAttendee] = useState<string | null>(null);
  const [editingAttendee, setEditingAttendee] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});

  // Status tab state
  const [feedbackTab, setFeedbackTab] = useState<"life" | "member">("life");
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPeriod, setAiPeriod] = useState("");
  const [aiCost, setAiCost] = useState("");
  const [aiResult, setAiResult] = useState("");

  // Feedback form generation
  const [showFeedbackGen, setShowFeedbackGen] = useState(false);
  const [fbAnonymous, setFbAnonymous] = useState(false);
  const [fbQuestions, setFbQuestions] = useState(["좋았던 점", "아쉬웠던 점"]);
  const [fbNewQ, setFbNewQ] = useState("");
  const [fbUrl, setFbUrl] = useState("");
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

  // Sessions (동아리 회차)
  const [sessions, setSessions] = useState<{ number: number; date: string }[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("all"); // "all" or session date
  const [aiLoading, setAiLoading] = useState(false);

  // 행사 설정 config 전체(세션 저장 시 다른 키 보존용) + 내 알림 수신 여부
  const [settingsConfig, setSettingsConfig] = useState<Record<string, any>>({});
  const [notifyOptOut, setNotifyOptOut] = useState(false); // 이 행사 신청 알림 안 받기

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
    if (eventRes.data) setEvent(eventRes.data);
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
    const loadedSessions = (loadedConfig.sessions as { number: number; date: string }[] | undefined) || [];
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
      setFbAnonymous(form.is_anonymous);
      setFbQuestions(form.questions);
      const { data: responses } = await supabase.from("event_feedback_responses").select("*").eq("form_id", form.id).order("created_at", { ascending: false });
      if (responses) setFeedbackResponses(responses);
    }
    setLoading(false);
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

  const isPresent = (attendeeId: string, date: string) => {
    return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.date === date && r.present === true);
  };

  const isNoShow = (attendeeId: string, date: string) => {
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
    const existing = attendanceRecords.find((r) => r.attendee_id === attendeeId && r.date === date);
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

  // --- Sorting ---
  const sortAttendees = (list: Attendee[]) => {
    return [...list].sort((a, b) => {
      // 노쇼는 무조건 맨 아래 (오는 사람이 잘 보이게)
      const aNo = isNoShowForView(a.id) ? 1 : 0;
      const bNo = isNoShowForView(b.id) ? 1 : 0;
      if (aNo !== bNo) return aNo - bNo;
      if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
      if (sortBy === "year") return (a.year || 0) - (b.year || 0);
      if (sortBy === "department") return (a.department || "").localeCompare(b.department || "", "ko");
      return 0;
    });
  };

  // --- Grouping ---
  const groupAttendees = (list: Attendee[]): { label: string; items: Attendee[] }[] => {
    // 생명만 필터 적용
    const filtered = lifeOnly ? list.filter((a) => !a.is_member) : list;
    const sorted = sortAttendees(filtered);

    if (groupBy === "default") return [{ label: "", items: sorted }];

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
      return Object.entries(groups).map(([label, items]) => ({ label, items }));
    }

    if (groupBy === "manager") {
      const groups: Record<string, Attendee[]> = {};
      sorted.forEach((a) => {
        const mgr = members.find((m) => m.user_id === a.manager_id);
        const key = mgr ? mgr.display_name : "미배정";
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      });
      return Object.entries(groups).map(([label, items]) => ({ label, items }));
    }

    if (groupBy === "friend") {
      // Group by department first, then friend_group
      const deptGroups: Record<string, Record<string, Attendee[]>> = {};
      sorted.forEach((a) => {
        const dept = a.department || "미분류";
        const fg = a.friend_group || "개인";
        if (!deptGroups[dept]) deptGroups[dept] = {};
        if (!deptGroups[dept][fg]) deptGroups[dept][fg] = [];
        deptGroups[dept][fg].push(a);
      });
      const result: { label: string; items: Attendee[] }[] = [];
      Object.entries(deptGroups).forEach(([dept, fgs]) => {
        Object.entries(fgs).forEach(([fg, items]) => {
          result.push({ label: `${dept} - ${fg}`, items });
        });
      });
      return result;
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
  const submitFeedback = async () => {
    if (!feedbackText.trim()) return;
    const user = getUser();
    const { data } = await supabase
      .from("event_feedback")
      .insert({
        event_id: eventId,
        content: feedbackText.trim(),
        type: "member",
        author_id: user?.id || null,
      })
      .select()
      .single();
    if (data) setFeedbacks((prev) => [data as Feedback, ...prev]);
    setFeedbackText("");
  };

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

  const getBarData = (field: "year" | "department") => {
    const counts: Record<string, number> = {};
    attendees.filter((a) => !a.is_member).forEach((a) => {
      const key = field === "year" ? (a.year != null ? formatYear(a.year) : "미입력") : (a.department || "미입력");
      counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return { entries, max };
  };

  // --- Attendance rate (club) ---
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

  const handleAiAnalyze = async () => {
    setAiLoading(true);
    setAiResult("");
    try {
      const stats = getStats();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventName: event?.name,
          eventType: event?.type,
          period: aiPeriod,
          totalCost: aiCost,
          totalApplicants: stats.total,
          totalAttended: stats.totalAttended,
          male: stats.male,
          female: stats.female,
          passed: stats.passed,
          attendees: attendees.map((a) => ({
            name: a.name,
            department: a.department,
            year: a.year,
            status: a.status,
            is_member: a.is_member,
          })),
          feedbacks: feedbacks.map((f) => ({ content: f.content, type: f.type })),
        }),
      });
      const data = await res.json();
      setAiResult(data.result || data.error || "분석 결과를 가져올 수 없습니다.");
    } catch {
      setAiResult("분석 요청에 실패했습니다.");
    }
    setAiLoading(false);
  };

  if (loading || !event) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center shrink-0">
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push(basePath); }} className="text-gray-500 mr-3">&larr;</button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">{event.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            event.type === "club" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
          }`}>
            {event.type === "club" ? "동아리" : "일회성"}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        {([["attendance", "출석"], ["detail", "상세"], ["status", "현황"], ["settings", "설정"]] as [Tab, string][]).map(([key, label]) => (
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
            {/* Form generation buttons */}
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
                {([["name", "이름순"], ["year", "학년순"], ["department", "학과순"]] as [SortOption, string][]).map(([val, label]) => (
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
                <button
                  onClick={() => setLifeOnly(!lifeOnly)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ml-auto ${
                    lifeOnly ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  생명만
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["default", "기본"],
                  ["team", "팀별"],
                  ["manager", "담당별"],
                  ["school", "학교별"],
                  ["attendance", "출석별"],
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

            {/* Attendee list (기본 뷰) */}
            {!(event?.type === "club" && event?.club_unit === "weekly" && selectedSession !== "all" && selectedSession.startsWith("week_")) &&
            groupAttendees(attendees).map((group, gi) => (
              <div key={gi}>
                {group.label && <p className="text-xs font-semibold text-gray-500 mt-3 mb-1">{group.label}</p>}
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {group.items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">해당 항목이 없습니다.</p>
                  )}
                  {group.items.map((a) => {
                    const noShow = isNoShow(a.id, selectedDate);
                    return (
                    <div key={a.id} className={`flex items-center px-3 py-2.5 ${noShow ? "opacity-40" : ""}`}>
                      {/* 주차별 보기일 때는 체크 비활성, 출석 횟수 표시 */}
                      {selectedSession.startsWith("week_") ? (
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
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium truncate ${noShow ? "line-through text-gray-400" : ""}`}>{a.name}</span>
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
            {/* 중복 의심 알림 */}
            {(() => {
              const dups: { a: Attendee; b: Attendee; reason: string }[] = [];
              for (let i = 0; i < attendees.length; i++) {
                for (let j = i + 1; j < attendees.length; j++) {
                  const a = attendees[i], b = attendees[j];
                  if (a.name === b.name) dups.push({ a, b, reason: "이름 동일" });
                  else if (a.phone && a.phone === b.phone) dups.push({ a, b, reason: "전화번호 동일" });
                }
              }
              if (dups.length === 0) return null;
              return (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                  <p className="text-xs font-medium text-yellow-800 mb-2">중복 의심 ({dups.length}건)</p>
                  {dups.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-yellow-700 py-1 border-t border-yellow-200 first:border-0">
                      <span>{d.a.name} ↔ {d.b.name} ({d.reason})</span>
                      <button onClick={async () => {
                        if (!confirm(`"${d.b.name}"을 삭제하고 "${d.a.name}"에 병합하시겠습니까?`)) return;
                        await supabase.from("event_attendance").delete().eq("attendee_id", d.b.id);
                        await supabase.from("event_attendees").delete().eq("id", d.b.id);
                        setAttendees(attendees.filter((x) => x.id !== d.b.id));
                      }} className="text-yellow-600 hover:text-red-500 font-medium">병합</button>
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

            {/* Sort + Group (same as attendance + friend) */}
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {([["name", "이름순"], ["year", "학년순"], ["department", "학과순"]] as [SortOption, string][]).map(([val, label]) => (
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
                <button
                  onClick={() => setLifeOnly(!lifeOnly)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ml-auto ${
                    lifeOnly ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  생명만
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["default", "기본"],
                  ["team", "팀별"],
                  ["manager", "담당별"],
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

            {/* Attendee detail cards */}
            {groupAttendees(attendees).map((group, gi) => (
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
                            {a.memo && <span>메모: {a.memo}</span>}
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
                                  <input type="text" value={a.friend_group || ""} onChange={(e) => updateAttendeeField(a.id, "friend_group", e.target.value || null)}
                                    placeholder="함께 신청한 친구" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
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
                                      <input type="text" value={a.custom_data?.[key] || ""} onChange={(e) => {
                                        const updated = { ...(a.custom_data || {}), [key]: e.target.value };
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
                              <select
                                value={a.manager_id || ""}
                                onChange={(e) => updateAttendeeField(a.id, "manager_id", e.target.value || null)}
                                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
                              >
                                <option value="">담당 미배정</option>
                                {members.map((m) => (
                                  <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                                ))}
                              </select>
                              )}
                            </div>
                          </div>
                        )}

                        {/* After mode: feedback only */}
                        {detailMode === "after" && (
                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <textarea
                              value={feedbackMap[a.id] || a.memo || ""}
                              onChange={(e) => setFeedbackMap((prev) => ({ ...prev, [a.id]: e.target.value }))}
                              onBlur={() => {
                                if (feedbackMap[a.id] !== undefined) {
                                  updateAttendeeField(a.id, "memo", feedbackMap[a.id]);
                                }
                              }}
                              placeholder="피드백 입력"
                              rows={2}
                              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:border-blue-400"
                            />
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
                          {!a.is_member && (
                            a.life_id ? (
                              <span className="text-xs text-green-600 font-medium ml-auto">생명 전환 완료</span>
                            ) : (
                              <button
                                onClick={async () => {
                                  const target = prompt("연결할 섭리회원 이름을 입력하세요\n" + members.map(m => m.display_name).join(", "));
                                  if (!target) return;
                                  const member = members.find(m => m.display_name === target.trim());
                                  if (!member) { alert("해당 섭리회원을 찾을 수 없습니다."); return; }
                                  const { data: life, error: lifeErr } = await supabase.from("lives").insert({
                                    name: a.name, stage: "first_meeting", department: a.department || null,
                                    age: a.year ? new Date().getFullYear() - (2000 + a.year) + 1 : null,
                                    gender: a.gender || null, phone: a.phone || null,
                                    characteristics: `[${event?.name}] 참여`,
                                    primary_user_id: member.user_id,
                                  }).select("id").single();
                                  if (!life || lifeErr) { alert("생명 등록 실패: " + (lifeErr?.message || "")); return; }
                                  await supabase.from("user_lives").insert({ user_id: member.user_id, life_id: life.id, role_in_life: "evangelist" });
                                  await supabase.from("event_attendees").update({ life_id: life.id }).eq("id", a.id);
                                  setAttendees(attendees.map(x => x.id === a.id ? { ...x, life_id: life.id } : x));
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
            {/* AI button */}
            <button
              onClick={() => setShowAiModal(true)}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:from-blue-700 hover:to-indigo-700 transition-colors"
            >
              AI 분석
            </button>

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

            {/* Bar charts */}
            {(["year", "department"] as const).map((field) => {
              const { entries, max } = getBarData(field);
              return (
                <div key={field} className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    {field === "year" ? "학년별" : "학과별"} 인원
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-xs text-gray-400">데이터가 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {entries.map(([label, count]) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16 shrink-0 truncate">{label}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                            <div
                              className="bg-blue-500 h-full rounded-full transition-all"
                              style={{ width: `${(count / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-600 w-6 text-right">{count}</span>
                        </div>
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
                {!fbUrl && (
                  <button onClick={() => setShowFeedbackGen(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg">
                    피드백 생성
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
              <div className="flex gap-2 mb-3">
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="피드백을 입력하세요"
                  rows={2}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={submitFeedback}
                  disabled={!feedbackText.trim()}
                  className="self-end bg-blue-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  등록
                </button>
              </div>
              <div className="space-y-2">
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
                {feedbacks.length === 0 && (
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

            {/* 포스터 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-700 mb-1">포스터</p>
              <p className="text-xs text-gray-500 mb-3">신청 페이지 상단에 표시됩니다.</p>
              {event?.poster_url ? (
                <div className="space-y-2">
                  <img src={event.poster_url} alt="행사 포스터" className="w-full rounded-lg border border-gray-200" />
                  <div className="flex gap-2">
                    <label className={`flex-1 cursor-pointer border border-gray-300 text-gray-700 rounded-lg py-2 text-sm text-center hover:bg-gray-50 ${posterUploading ? "opacity-50 pointer-events-none" : ""}`}>
                      {posterUploading ? "업로드 중..." : "교체"}
                      <input type="file" accept="image/*" className="hidden" disabled={posterUploading}
                        onChange={async (e) => {
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
                        }} />
                    </label>
                    <button disabled={posterUploading}
                      onClick={async () => {
                        if (!event?.poster_url) return;
                        if (!confirm("포스터를 삭제할까요?")) return;
                        const path = event.poster_url.split("/event-posters/")[1];
                        if (path) await supabase.storage.from("event-posters").remove([path]).catch(() => {});
                        await supabase.from("events").update({ poster_url: null }).eq("id", eventId);
                        setEvent({ ...event, poster_url: null });
                      }}
                      className="flex-1 bg-red-50 text-red-600 rounded-lg py-2 text-sm disabled:opacity-50">삭제</button>
                  </div>
                </div>
              ) : (
                <label className={`block w-full border-2 border-dashed border-gray-300 rounded-lg py-8 text-center text-sm cursor-pointer hover:border-blue-400 hover:text-blue-500 ${posterUploading ? "text-gray-400 pointer-events-none" : "text-gray-500"}`}>
                  {posterUploading ? "업로드 중..." : "+ 이미지 선택"}
                  <input type="file" accept="image/*" className="hidden" disabled={posterUploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f || !event) return;
                      setPosterUploading(true);
                      try {
                        const blob = await resizeImage(f);
                        const path = `${eventId}/${Date.now()}.jpg`;
                        const { error: upErr } = await supabase.storage.from("event-posters").upload(path, blob, { contentType: "image/jpeg", upsert: true });
                        if (upErr) throw upErr;
                        const publicUrl = supabase.storage.from("event-posters").getPublicUrl(path).data.publicUrl;
                        const { error: dbErr } = await supabase.from("events").update({ poster_url: publicUrl }).eq("id", eventId);
                        if (dbErr) throw dbErr;
                        setEvent({ ...event, poster_url: publicUrl });
                      } catch (err: any) {
                        alert("업로드 실패: " + (err?.message || "알 수 없는 오류"));
                      } finally {
                        setPosterUploading(false);
                        e.target.value = "";
                      }
                    }} />
                </label>
              )}
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

            {/* 회차 설정 (주차별 동아리 제외) */}
            {!(event?.type === "club" && event.club_unit === "weekly") && (
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
            <h3 className="text-sm font-bold">피드백 폼 생성</h3>
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
                const { data } = await supabase.from("event_feedback_forms").insert({
                  event_id: eventId,
                  is_anonymous: fbAnonymous,
                  questions: fbQuestions,
                  created_by: getUser()?.id,
                }).select("id").single();
                if (data) {
                  const url = `${publicBase()}/feedback/${data.id}`;
                  setFbUrl(url);
                }
                setShowFeedbackGen(false);
              }}
              disabled={fbQuestions.length === 0}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
            >
              생성하기
            </button>
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
              <div className="flex gap-2">
                <button onClick={() => { setShowAddModal(false); setShowExcelModal(true); }} className="text-xs text-green-600 hover:underline">엑셀 업로드</button>
                <button onClick={() => setShowAddModal(false)} className="text-xs text-gray-400">닫기</button>
              </div>
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

      {/* AI analysis modal */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowAiModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">AI 분석</h3>
              <button onClick={() => setShowAiModal(false)} className="text-xs text-gray-400">닫기</button>
            </div>
            {!aiResult ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={aiPeriod}
                  onChange={(e) => setAiPeriod(e.target.value)}
                  placeholder="행사 기간 (예: 3일)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                <input
                  type="text"
                  value={aiCost}
                  onChange={(e) => setAiCost(e.target.value)}
                  placeholder="총 비용 (예: 500000)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={handleAiAnalyze}
                  disabled={aiLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {aiLoading ? "분석 중..." : "분석 시작"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 whitespace-pre-wrap">
                  {aiResult}
                </div>
                <button
                  onClick={() => { setAiResult(""); setAiPeriod(""); setAiCost(""); }}
                  className="w-full border border-gray-200 text-gray-500 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  다시 분석
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
