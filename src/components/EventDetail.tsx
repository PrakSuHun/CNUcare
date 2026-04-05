"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

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
}

interface Attendee {
  id: string;
  name: string;
  gender: string | null;
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
}

interface Feedback {
  id: string;
  content: string;
  type: "life" | "member";
  author_id: string | null;
  created_at: string;
}

type Tab = "attendance" | "detail" | "status";
type SortOption = "name" | "year" | "department";
type GroupOption = "default" | "team" | "manager" | "lifeOnly" | "attendance" | "friend";

export default function EventDetail({ eventId, basePath }: EventDetailProps) {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("attendance");

  // Attendance tab state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [groupBy, setGroupBy] = useState<GroupOption>("default");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAttendeeName, setNewAttendeeName] = useState("");
  const [newAttendeeGender, setNewAttendeeGender] = useState("");
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
  const [regCustomFields, setRegCustomFields] = useState<string[]>([]);
  const [regNewField, setRegNewField] = useState("");
  const [checkinType, setCheckinType] = useState<"individual" | "team">("individual");
  const [checkinPopupText, setCheckinPopupText] = useState("");
  const [checkinShowFields, setCheckinShowFields] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

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

    // 기존 신청/출석 폼 URL 로드
    const ev = eventRes.data;
    const { data: existingForms } = await supabase.from("event_forms").select("id, type, config").eq("event_id", eventId);
    (existingForms || []).forEach((f: any) => {
      if (f.type === "registration") setRegFormUrl(`${window.location.origin}/register/${f.id}`);
      if (f.type === "checkin_individual") setCheckinFormUrl(`${window.location.origin}/checkin/${f.id}`);
      if (f.type === "checkin_team") setCheckinFormUrl(`${window.location.origin}/check/${encodeURIComponent(ev?.slug || eventId)}`);
    });

    // 히든 피드백: 기존 폼이 있으면 URL 세팅 + 응답 조회
    const { data: forms } = await supabase.from("event_feedback_forms").select("id, is_anonymous, questions").eq("event_id", eventId).limit(1);
    if (forms && forms.length > 0) {
      const form = forms[0] as any;
      setFbUrl(`${window.location.origin}/feedback/${form.id}`);
      setFbAnonymous(form.is_anonymous);
      setFbQuestions(form.questions);
      const { data: responses } = await supabase.from("event_feedback_responses").select("*").eq("form_id", form.id).order("created_at", { ascending: false });
      if (responses) setFeedbackResponses(responses);
    }
    setLoading(false);
  };

  // --- Attendance helpers ---
  const isPresent = (attendeeId: string, date: string) => {
    return attendanceRecords.some((r) => r.attendee_id === attendeeId && r.date === date && r.present);
  };

  const toggleAttendance = async (attendeeId: string, date: string) => {
    const existing = attendanceRecords.find((r) => r.attendee_id === attendeeId && r.date === date);
    const newPresent = existing ? !existing.present : true;

    if (existing) {
      await supabase.from("event_attendance").update({ present: newPresent }).eq("id", existing.id);
      setAttendanceRecords((prev) =>
        prev.map((r) => (r.id === existing.id ? { ...r, present: newPresent } : r))
      );
    } else {
      const { data } = await supabase
        .from("event_attendance")
        .insert({ event_id: eventId, attendee_id: attendeeId, date, present: true })
        .select()
        .single();
      if (data) setAttendanceRecords((prev) => [...prev, data as AttendanceRecord]);
    }
  };

  const addAttendee = async () => {
    if (!newAttendeeName.trim()) return;
    const { data } = await supabase
      .from("event_attendees")
      .insert({
        event_id: eventId,
        name: newAttendeeName.trim(),
        gender: newAttendeeGender || null,
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
    setNewAttendeeDept("");
    setNewAttendeeYear("");
    setNewAttendeePhone("");
    setNewAttendeeFriend("");
    setShowAddModal(false);
  };

  // --- Sorting ---
  const sortAttendees = (list: Attendee[]) => {
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "ko");
      if (sortBy === "year") return (a.year || 0) - (b.year || 0);
      if (sortBy === "department") return (a.department || "").localeCompare(b.department || "", "ko");
      return 0;
    });
  };

  // --- Grouping ---
  const groupAttendees = (list: Attendee[]): { label: string; items: Attendee[] }[] => {
    const sorted = sortAttendees(list);

    if (groupBy === "default") return [{ label: "", items: sorted }];

    if (groupBy === "lifeOnly") return [{ label: "생명만", items: sorted.filter((a) => !a.is_member) }];

    if (groupBy === "attendance") {
      const present = sorted.filter((a) => isPresent(a.id, selectedDate));
      const absent = sorted.filter((a) => !isPresent(a.id, selectedDate));
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

    return [{ label: "", items: sorted }];
  };

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
    const total = attendees.length;
    const lifeOnly = attendees.filter((a) => !a.is_member);
    const presentToday = attendees.filter((a) => attendanceRecords.some((r) => r.attendee_id === a.id && r.present));
    const male = lifeOnly.filter((a) => a.gender === "남").length;
    const female = lifeOnly.filter((a) => a.gender === "여").length;
    const passed = attendees.filter((a) => a.status === "pass").length;
    return { total, totalAttended: presentToday.length, male, female, passed };
  };

  const getBarData = (field: "year" | "department") => {
    const counts: Record<string, number> = {};
    attendees.filter((a) => !a.is_member).forEach((a) => {
      const key = field === "year" ? (a.year ? String(a.year) : "미입력") : (a.department || "미입력");
      counts[key] = (counts[key] || 0) + 1;
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(...entries.map(([, v]) => v), 1);
    return { entries, max };
  };

  // --- Attendance rate (club) ---
  const getAttendanceRates = () => {
    const lifeAttendees = attendees.filter((a) => !a.is_member);
    return lifeAttendees.map((a) => {
      const records = attendanceRecords.filter((r) => r.attendee_id === a.id);
      const totalDays = new Set(records.map((r) => r.date)).size || records.length;
      const attended = records.filter((r) => r.present).length;
      // Use unique dates across entire event for total
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
        <button onClick={() => router.push(basePath)} className="text-gray-500 mr-3">&larr;</button>
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
        {([["attendance", "출석"], ["detail", "상세"], ["status", "현황"]] as [Tab, string][]).map(([key, label]) => (
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
            <div className="flex gap-2">
              {regFormUrl ? (
                <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-2">
                  <p className="text-[10px] text-green-600 mb-1">신청폼</p>
                  <div className="flex gap-1">
                    <input value={regFormUrl} readOnly className="flex-1 text-[10px] border border-green-200 rounded px-1.5 py-1 bg-white min-w-0" />
                    <button onClick={() => { navigator.clipboard.writeText(regFormUrl); alert("복사!"); }} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded shrink-0">복사</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowRegGen(true)} className="flex-1 text-xs bg-green-600 text-white py-2.5 rounded-lg font-medium">신청폼 생성</button>
              )}
              {checkinFormUrl ? (
                <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-2">
                  <p className="text-[10px] text-orange-600 mb-1">출석체크</p>
                  <div className="flex gap-1">
                    <input value={checkinFormUrl} readOnly className="flex-1 text-[10px] border border-orange-200 rounded px-1.5 py-1 bg-white min-w-0" />
                    <button onClick={() => { navigator.clipboard.writeText(checkinFormUrl); alert("복사!"); }} className="text-[10px] bg-orange-600 text-white px-2 py-1 rounded shrink-0">복사</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCheckinGen(true)} className="flex-1 text-xs bg-orange-500 text-white py-2.5 rounded-lg font-medium">출석체크 생성</button>
              )}
            </div>

            {/* Club: week selector */}
            {event.type === "club" && (
              <div className="flex items-center gap-2">
                <button onClick={() => setClubWeek((w) => Math.max(1, w - 1))} className="text-gray-400 px-2 py-1 rounded hover:bg-gray-100">&lt;</button>
                <span className="text-sm font-medium">{clubWeek}주차</span>
                <button onClick={() => setClubWeek((w) => w + 1)} className="text-gray-400 px-2 py-1 rounded hover:bg-gray-100">&gt;</button>
                <button
                  onClick={() => setShowRateModal(true)}
                  className="ml-auto text-xs text-blue-600 border border-blue-300 rounded-full px-3 py-1 hover:bg-blue-50"
                >
                  출석률
                </button>
              </div>
            )}

            {/* Date selector */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={() => setShowAddModal(true)}
                className="text-xs text-blue-600 border border-blue-300 rounded-full px-3 py-1.5 hover:bg-blue-50 whitespace-nowrap"
              >
                + 참석자 추가
              </button>
            </div>

            {/* Sort + Group */}
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {([["name", "이름순"], ["year", "학번순"], ["department", "학과순"]] as [SortOption, string][]).map(([val, label]) => (
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
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["default", "기본"],
                  ["team", "팀별"],
                  ["manager", "관리자별"],
                  ["lifeOnly", "생명만"],
                  ["attendance", "출석별"],
                ] as [GroupOption, string][]).map(([val, label]) => (
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

            {/* Attendee list */}
            {groupAttendees(attendees).map((group, gi) => (
              <div key={gi}>
                {group.label && <p className="text-xs font-semibold text-gray-500 mt-3 mb-1">{group.label}</p>}
                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {group.items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">해당 항목이 없습니다.</p>
                  )}
                  {group.items.map((a) => (
                    <div key={a.id} className="flex items-center px-3 py-2.5">
                      <button
                        onClick={() => toggleAttendance(a.id, selectedDate)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center mr-3 shrink-0 transition-colors ${
                          isPresent(a.id, selectedDate)
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-gray-300 text-transparent"
                        }`}
                      >
                        ✓
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{a.name}</span>
                          {a.is_member && (
                            <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full shrink-0">섭리</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                          {a.team && <span>{a.team}</span>}
                          {a.year && <span>{a.year}학번</span>}
                          {a.department && <span>{a.department}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== 상세 Tab ===== */}
        {activeTab === "detail" && (
          <div className="p-4 space-y-3">
            {/* Mode toggle */}
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

            {/* Sort + Group (same as attendance + friend) */}
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {([["name", "이름순"], ["year", "학번순"], ["department", "학과순"]] as [SortOption, string][]).map(([val, label]) => (
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
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ["default", "기본"],
                  ["team", "팀별"],
                  ["manager", "관리자별"],
                  ["lifeOnly", "생명만"],
                  ["attendance", "출석별"],
                  ["friend", "친구별"],
                ] as [GroupOption, string][]).map(([val, label]) => (
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
                          onClick={() => setExpandedAttendee(isExpanded ? null : a.id)}
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
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                            {a.department && <span>{a.department}</span>}
                            {a.year && <span>{a.year}학번</span>}
                            {a.friend_group && <span>친구: {a.friend_group}</span>}
                            {a.memo && <span>메모: {a.memo}</span>}
                          </div>
                        </button>

                        {/* Expanded: phone + info */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                            <div className="space-y-1.5">
                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <span className="text-[10px] text-gray-400">연락처</span>
                                  <input type="tel" value={a.phone || ""} onChange={(e) => updateAttendeeField(a.id, "phone", e.target.value || null)}
                                    placeholder="연락처" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                                </div>
                                <div>
                                  <span className="text-[10px] text-gray-400">학과</span>
                                  <input type="text" value={a.department || ""} onChange={(e) => updateAttendeeField(a.id, "department", e.target.value || null)}
                                    placeholder="학과" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400" />
                                </div>
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
                              {a.custom_data && Object.entries(a.custom_data).map(([key, val]) => (
                                val && <div key={key} className="text-xs text-gray-500">{key}: {val}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Before mode: team + manager assignment */}
                        {detailMode === "before" && (
                          <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
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
                            <select
                              value={a.manager_id || ""}
                              onChange={(e) => updateAttendeeField(a.id, "manager_id", e.target.value || null)}
                              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
                            >
                              <option value="">관리자 미배정</option>
                              {members.map((m) => (
                                <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* After mode: feedback + 생명 전환 */}
                        {detailMode === "after" && (
                          <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
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
                            {a.life_id ? (
                              <div className="text-xs text-green-600 font-medium">생명 전환 완료</div>
                            ) : (
                              <button
                                onClick={async () => {
                                  const target = prompt("연결할 섭리회원 이름을 입력하세요\n" + members.map(m => m.display_name).join(", "));
                                  if (!target) return;
                                  const member = members.find(m => m.display_name === target.trim());
                                  if (!member) { alert("해당 섭리회원을 찾을 수 없습니다."); return; }
                                  // 생명 등록
                                  const { data: life } = await supabase.from("lives").insert({
                                    name: a.name,
                                    stage: "first_meeting",
                                    department: a.department,
                                    age: a.year ? new Date().getFullYear() - (2000 + a.year) + 1 : null,
                                    gender: a.gender,
                                    phone: a.phone,
                                    note: `[${event?.name}] 참여`,
                                  }).select("id").single();
                                  if (!life) { alert("생명 등록 실패"); return; }
                                  // user_lives 연결
                                  await supabase.from("user_lives").insert({ user_id: member.user_id, life_id: life.id, role_in_life: "evangelist" });
                                  // attendee에 life_id 연결
                                  await supabase.from("event_attendees").update({ life_id: life.id }).eq("id", a.id);
                                  setAttendees(attendees.map(x => x.id === a.id ? { ...x, life_id: life.id } : x));
                                }}
                                className="w-full text-xs py-1.5 rounded font-medium bg-blue-50 text-blue-600 border border-blue-300 hover:bg-blue-100 transition-colors"
                              >
                                생명 전환
                              </button>
                            )}
                          </div>
                        )}

                        {/* 삭제 */}
                        <button
                          onClick={async () => {
                            if (!confirm(`"${a.name}" 참가자를 삭제하시겠습니까?`)) return;
                            await supabase.from("event_attendance").delete().eq("attendee_id", a.id);
                            await supabase.from("event_attendees").delete().eq("id", a.id);
                            setAttendees(attendees.filter((x) => x.id !== a.id));
                          }}
                          className="text-xs text-red-400 hover:text-red-600 mt-1"
                        >
                          참가자 삭제
                        </button>
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
      </div>

      {/* ===== Modals ===== */}

      {/* Registration form generation modal */}
      {showRegGen && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowRegGen(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold">행사 신청폼 생성</h3>
            <p className="text-xs text-gray-500">기본: 이름, 성별, 학년, 학과, 연락처, 함께 신청한 친구</p>
            <div>
              <p className="text-xs text-gray-500 mb-2">추가 항목 (텍스트)</p>
              <div className="space-y-2">
                {regCustomFields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm bg-gray-50 rounded-lg px-3 py-2">{f}</span>
                    <button onClick={() => setRegCustomFields(regCustomFields.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-400">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input value={regNewField} onChange={(e) => setRegNewField(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (regNewField.trim()) { setRegCustomFields([...regCustomFields, regNewField.trim()]); setRegNewField(""); } } }}
                  placeholder="항목 이름" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button onClick={() => { if (regNewField.trim()) { setRegCustomFields([...regCustomFields, regNewField.trim()]); setRegNewField(""); } }}
                  className="text-sm bg-gray-200 px-3 py-2 rounded-lg">추가</button>
              </div>
            </div>
            <button onClick={async () => {
              const { data } = await supabase.from("event_forms").insert({
                event_id: eventId, type: "registration",
                config: { custom_fields: regCustomFields },
                created_by: getUser()?.id,
              }).select("id").single();
              if (data) setRegFormUrl(`${window.location.origin}/register/${data.id}`);
              setShowRegGen(false);
            }} className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium">생성하기</button>
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
                    {[["department","학과"],["team","팀"],["year","학번"],["gender","성별"]].map(([key, label]) => (
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
                const { data } = await supabase.from("event_forms").insert({
                  event_id: eventId, type: "checkin_individual",
                  config: { popup_text: checkinPopupText, show_fields: checkinShowFields },
                  created_by: getUser()?.id,
                }).select("id").single();
                if (data) setCheckinFormUrl(`${window.location.origin}/checkin/${data.id}`);
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
                setCheckinFormUrl(`${window.location.origin}/check/${encodeURIComponent(slug)}`);
              }
              setShowCheckinGen(false);
            }} className="w-full bg-orange-500 text-white rounded-lg py-2.5 text-sm font-medium">생성하기</button>
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
                  const url = `${window.location.origin}/feedback/${data.id}`;
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

      {/* Add attendee modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">참석자 추가</h3>
              <button onClick={() => setShowAddModal(false)} className="text-xs text-gray-400">닫기</button>
            </div>
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
