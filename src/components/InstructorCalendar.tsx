"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { revertStageIfOrphaned } from "@/lib/autoStage";

interface CalEvent {
  id: string;
  type: "appointment" | "personal" | "group";
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  purpose?: string | null;
  life_name?: string;
  life_id?: string;
  group_name?: string;
  instructor_name?: string | null;
  memo?: string | null;
}

interface GroupInfo {
  id: string;
  name: string;
  is_visible: boolean;
}

const PURPOSE_LABELS: Record<string, string> = {
  pre_visit: "전초", management: "관리", lecture: "강의",
};

const TYPE_COLORS: Record<string, string> = {
  appointment: "bg-blue-500",
  personal: "bg-green-500",
  group: "bg-orange-500",
};

const TYPE_DOT_COLORS: Record<string, string> = {
  appointment: "bg-blue-400",
  personal: "bg-green-400",
  group: "bg-orange-400",
};

export default function InstructorCalendar({ basePath }: { basePath: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"" | "pre_visit" | "management" | "lecture" | "personal" | "group">("");
  const [myLives, setMyLives] = useState<{ id: string; name: string }[]>([]);
  const [allGroups, setAllGroups] = useState<{ id: string; name: string }[]>([]);
  const [viewingEvent, setViewingEvent] = useState<CalEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", date: "", time: "", location: "", memo: "",
    shared_with: [] as string[], share_input: "",
    purpose: "", instructor_name: "", pre_visit_type: "", other_name: "",
  });
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [searchedGroups, setSearchedGroups] = useState<{ id: string; name: string }[]>([]);

  // 폼
  const [form, setForm] = useState({
    life_id: "", title: "", date: "", time: "", location: "", memo: "",
    instructor_name: "", pre_visit_type: "", other_name: "",
    shared_with: [] as string[], share_input: "",
    group_id: "", new_group_name: "", group_mode: "" as "" | "new" | "existing",
    members: [] as string[],
    member_input: "",
  });
  const [managerName, setManagerName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const user = getUser();
    if (!user) return;

    // 내 생명
    const { data: ul } = await supabase.from("user_lives").select("life_id, lives(id, name)").eq("user_id", user.id);
    setMyLives((ul || []).map((u: any) => u.lives).filter(Boolean));

    // 관리자 이름
    const { data: me } = await supabase.from("users").select("manager_id").eq("id", user.id).single();
    if (me?.manager_id) {
      const { data: mgr } = await supabase.from("users").select("display_name").eq("id", me.manager_id).single();
      if (mgr) setManagerName(mgr.display_name);
    }

    // 생명 약속 조회
    const lifeIds = (ul || []).map((u: any) => u.life_id);
    let apptEvents: CalEvent[] = [];

    // 대학생: 내 생명의 모든 약속 + 내가 만든 것 + 내 이름 지정 + 공유 대상
    // 그 외: 내가 만든 것 + 내 이름 지정 + 공유 대상
    let apptQuery = supabase.from("appointments").select("*, life:lives(name)");

    if (user.role === "student" && lifeIds.length > 0) {
      apptQuery = apptQuery.or(
        `created_by.eq.${user.id},instructor_name.eq.${user.display_name},life_id.in.(${lifeIds.join(",")}),shared_with.cs.{${user.display_name}}`
      );
    } else {
      apptQuery = apptQuery.or(
        `created_by.eq.${user.id},instructor_name.eq.${user.display_name},shared_with.cs.{${user.display_name}}`
      );
    }

    const { data: appts } = await apptQuery.order("date");
    // 중복 제거
    const seenIds = new Set<string>();
    apptEvents = (appts || []).filter((a: any) => {
      if (seenIds.has(a.id)) return false;
      seenIds.add(a.id);
      return true;
    }).map((a: any) => ({
      id: a.id, type: "appointment" as const, title: a.title,
      date: a.date, time: a.time, location: a.location,
      purpose: a.purpose, life_name: a.life?.name, life_id: a.life_id, instructor_name: a.instructor_name, memo: a.note,
    }));

    // 개인일정 (내꺼 + 나에게 공유된 것)
    const { data: personal } = await supabase
      .from("personal_events").select("*")
      .or(`user_id.eq.${user.id},shared_with.cs.{${user.display_name}}`)
      .order("date");
    const personalEvents: CalEvent[] = (personal || []).map((p: any) => ({
      id: p.id, type: "personal" as const, title: p.title,
      date: p.date, time: p.time, location: p.location, memo: p.memo,
    }));

    // 그룹 멤버십
    const { data: memberships } = await supabase
      .from("event_group_members").select("group_id, is_visible, event_groups(id, name)")
      .eq("user_id", user.id);
    const groupList: GroupInfo[] = (memberships || []).map((m: any) => ({
      id: m.event_groups?.id, name: m.event_groups?.name, is_visible: m.is_visible,
    })).filter((g: any) => g.id);
    setGroups(groupList);

    // 보이는 그룹의 일정
    const visibleGroupIds = groupList.filter((g) => g.is_visible).map((g) => g.id);
    let groupEvents: CalEvent[] = [];
    if (visibleGroupIds.length > 0) {
      const { data: gEvents } = await supabase
        .from("group_events").select("*, event_groups(name)")
        .in("group_id", visibleGroupIds).order("date");
      groupEvents = (gEvents || []).map((g: any) => ({
        id: g.id, type: "group" as const, title: g.title,
        date: g.date, time: g.time, location: g.location,
        group_name: g.event_groups?.name, memo: g.memo,
      }));
    }

    setEvents([...apptEvents, ...personalEvents, ...groupEvents]);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ life_id: "", title: "", date: selectedDate, time: "", location: "", memo: "",
      instructor_name: "", pre_visit_type: "", other_name: "",
      shared_with: [], share_input: "",
      group_id: "", new_group_name: "", group_mode: "", members: [], member_input: "" });
    setFormType("");
    setShowForm(false);
  };

  const handleSave = async () => {
    const user = getUser();
    if (!user) return;
    setSaving(true);

    if (formType === "personal") {
      await supabase.from("personal_events").insert({
        user_id: user.id, title: form.title || "개인일정",
        date: form.date, time: form.time || null, location: form.location || null, memo: form.memo || null,
        shared_with: form.shared_with.length > 0 ? form.shared_with : [],
      });
    } else if (formType === "group") {
      let groupId = form.group_id;
      if (form.group_mode === "new" && form.new_group_name) {
        const { data: newGroup } = await supabase.from("event_groups")
          .insert({ name: form.new_group_name, created_by: user.id }).select("id").single();
        if (newGroup) {
          groupId = newGroup.id;
          // 본인을 멤버로 추가
          await supabase.from("event_group_members").insert({ group_id: groupId, user_id: user.id });
          // 추가 멤버
          for (const memberName of form.members) {
            const { data: matched } = await supabase.from("users").select("id").eq("display_name", memberName);
            if (matched) {
              for (const m of matched) {
                await supabase.from("event_group_members").upsert(
                  { group_id: groupId, user_id: m.id }, { onConflict: "group_id,user_id" }
                );
              }
            }
          }
        }
      }
      if (groupId) {
        await supabase.from("group_events").insert({
          group_id: groupId, title: form.title || "행사", date: form.date,
          time: form.time || null, location: form.location || null, memo: form.memo || null, created_by: user.id,
        });
      }
    } else if (["pre_visit", "management", "lecture"].includes(formType) && form.life_id) {
      let assignee: string | null = null;
      if (formType === "pre_visit" || formType === "management") {
        if (form.pre_visit_type === "manager") assignee = managerName;
        else if (form.pre_visit_type === "self") assignee = user.display_name;
        else if (form.pre_visit_type === "other") assignee = form.other_name || null;
      } else if (formType === "lecture") {
        assignee = form.instructor_name || null;
      }
      await supabase.from("appointments").insert({
        life_id: form.life_id, title: form.title || PURPOSE_LABELS[formType] || formType,
        purpose: formType, date: form.date, time: form.time || null,
        location: form.location || null, instructor_name: assignee, note: form.memo || null, created_by: user.id,
        shared_with: form.shared_with.length > 0 ? form.shared_with : [],
      });
    }

    resetForm();
    setSaving(false);
    fetchAll();
  };

  const openEventDetail = (e: CalEvent) => {
    setViewingEvent(e);
    setEditingEvent(false);
    setEditForm({ title: e.title, date: e.date, time: e.time || "", location: e.location || "", memo: e.memo || "",
      shared_with: [], share_input: "", purpose: e.purpose || "", instructor_name: "", pre_visit_type: "", other_name: "" });
  };

  const handleEditSave = async () => {
    if (!viewingEvent) return;
    setSaving(true);
    const updateData = {
      title: editForm.title, date: editForm.date,
      time: editForm.time || null, location: editForm.location || null,
    };

    if (viewingEvent.type === "appointment") {
      await supabase.from("appointments").update({
        ...updateData, note: editForm.memo || null, shared_with: editForm.shared_with,
        purpose: editForm.purpose || null,
        instructor_name: editForm.purpose === "lecture" ? (editForm.instructor_name || null)
          : editForm.pre_visit_type === "self" ? (getUser()?.display_name || null)
          : editForm.pre_visit_type === "other" ? (editForm.other_name || null)
          : editForm.pre_visit_type === "manager" ? (editForm.instructor_name || null)
          : (editForm.instructor_name || null),
      }).eq("id", viewingEvent.id);
    } else if (viewingEvent.type === "personal") {
      await supabase.from("personal_events").update({ ...updateData, memo: editForm.memo || null, shared_with: editForm.shared_with }).eq("id", viewingEvent.id);
    } else if (viewingEvent.type === "group") {
      await supabase.from("group_events").update({ ...updateData, memo: editForm.memo || null }).eq("id", viewingEvent.id);
    }

    setSaving(false);
    setViewingEvent(null);
    setEditingEvent(false);
    fetchAll();
  };

  const handleDelete = async (event: CalEvent) => {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;
    if (event.type === "appointment") {
      let lifeId = event.life_id;
      if (!lifeId) {
        const { data: appt } = await supabase.from("appointments").select("life_id").eq("id", event.id).single();
        lifeId = appt?.life_id;
      }
      await supabase.from("appointments").delete().eq("id", event.id);
      if (lifeId) await revertStageIfOrphaned(lifeId);
    }
    else if (event.type === "personal") await supabase.from("personal_events").delete().eq("id", event.id);
    else if (event.type === "group") await supabase.from("group_events").delete().eq("id", event.id);
    fetchAll();
  };

  const toggleGroupVisibility = async (groupId: string, visible: boolean) => {
    const user = getUser();
    if (!user) return;
    await supabase.from("event_group_members").update({ is_visible: visible })
      .eq("group_id", groupId).eq("user_id", user.id);
    fetchAll();
  };

  const leaveGroup = async (groupId: string) => {
    const user = getUser();
    if (!user || !confirm("이 그룹에서 나가시겠습니까?")) return;
    await supabase.from("event_group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
    fetchAll();
  };

  const searchGroups = async () => {
    if (!groupSearch.trim()) return;
    const { data } = await supabase.from("event_groups").select("id, name").ilike("name", `%${groupSearch}%`).limit(10);
    setSearchedGroups(data || []);
  };

  const joinGroup = async (groupId: string) => {
    const user = getUser();
    if (!user) return;
    await supabase.from("event_group_members").upsert({ group_id: groupId, user_id: user.id }, { onConflict: "group_id,user_id" });
    setGroupSearch("");
    setSearchedGroups([]);
    fetchAll();
  };

  const addMember = () => {
    if (!form.member_input.trim()) return;
    setForm((f) => ({ ...f, members: [...f.members, f.member_input.trim()], member_input: "" }));
  };

  const removeMember = (idx: number) => {
    setForm((f) => ({ ...f, members: f.members.filter((_, i) => i !== idx) }));
  };

  // 달력
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split("T")[0];

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dayEvents = (day: number) => events.filter((e) => e.date === getDateStr(day));
  const selectedEvents = events.filter((e) => e.date === selectedDate);

  if (loading) return <p className="text-center text-sm text-gray-400 py-8">로딩 중...</p>;

  return (
    <div className="space-y-4">
      {/* 달력 */}
      <div className="bg-white rounded-lg border border-gray-200 p-2">
        <div className="flex items-center justify-between mb-3 px-1">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="text-gray-400 px-3 py-1 hover:bg-gray-100 rounded">&larr;</button>
          <span className="text-base font-bold">{year}년 {month + 1}월</span>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="text-gray-400 px-3 py-1 hover:bg-gray-100 rounded">&rarr;</button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] text-gray-400 mb-1 border-b border-gray-100 pb-1">
          {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
            <span key={d} className={i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : ""}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            if (!day) return <div key={i} className="min-h-[72px] border-b border-r border-gray-50" />;
            const dateStr = getDateStr(day);
            const de = dayEvents(day);
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dayOfWeek = (firstDay + day - 1) % 7;

            const formatTime = (t: string | null) => {
              if (!t) return "";
              const [h, m] = t.split(":");
              return `${parseInt(h)}시`;
            };

            const getEventLabel = (e: CalEvent) => {
              const time = formatTime(e.time);
              if (e.type === "appointment") {
                const purposeLabel = PURPOSE_LABELS[e.purpose || ""] || "";
                const instrLabel = e.purpose === "lecture" && e.instructor_name ? `(${e.instructor_name})` : "";
                return `${time} ${e.life_name || ""} ${purposeLabel}${instrLabel}`.trim();
              }
              if (e.type === "group") return `${time} ${e.title}`.trim();
              return `${time} ${e.title}`.trim();
            };

            return (
              <button key={i} onClick={() => setSelectedDate(dateStr)}
                className={`min-h-[72px] border-b border-r border-gray-50 p-0.5 text-left transition-colors ${
                  isSelected ? "bg-blue-50" : isToday ? "bg-yellow-50" : "hover:bg-gray-50"
                }`}>
                <span className={`text-[11px] font-medium block px-1 ${
                  isSelected ? "text-blue-600" : isToday ? "text-blue-600 font-bold" :
                  dayOfWeek === 0 ? "text-red-400" : dayOfWeek === 6 ? "text-blue-400" : "text-gray-700"
                }`}>{day}</span>
                <div className="space-y-0.5 mt-0.5">
                  {de.slice(0, 3).map((e, j) => (
                    <div key={j} className={`text-[9px] leading-tight px-1 py-0.5 rounded truncate ${
                      e.type === "appointment" ? "bg-blue-100 text-blue-700" :
                      e.type === "personal" ? "bg-green-100 text-green-700" :
                      "bg-orange-100 text-orange-700"
                    }`}>
                      {getEventLabel(e)}
                    </div>
                  ))}
                  {de.length > 3 && (
                    <span className="text-[8px] text-gray-400 px-1">+{de.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 일정 추가 */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{selectedDate} ({selectedEvents.length}건)</p>
        <button onClick={() => { setForm((f) => ({ ...f, date: selectedDate })); setShowForm(!showForm); }}
          className="text-xs text-blue-500 border border-blue-300 rounded-full px-3 py-1">
          {showForm ? "취소" : "+ 일정 추가"}
        </button>
      </div>

      {/* 일정 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          {/* 유형 선택 */}
          <div className="grid grid-cols-5 gap-1">
            {[
              { key: "pre_visit", label: "전초" }, { key: "management", label: "관리" },
              { key: "lecture", label: "강의" }, { key: "personal", label: "개인" },
              { key: "group", label: "행사" },
            ].map((t) => (
              <button key={t.key} type="button" onClick={() => setFormType(t.key as any)}
                className={`py-2 rounded-lg border text-xs font-medium ${
                  formType === t.key ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"
                }`}>{t.label}</button>
            ))}
          </div>

          {/* 생명 선택 (전초/관리/강의) */}
          {["pre_visit", "management", "lecture"].includes(formType) && (
            <select value={form.life_id} onChange={(e) => setForm((f) => ({ ...f, life_id: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
              <option value="">생명 선택</option>
              {myLives.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}

          {/* 전초/관리 담당자 */}
          {(formType === "pre_visit" || formType === "management") && (
            <div className="space-y-1">
              {[
                { key: "manager", label: `${managerName || "관리자"} 연결` },
                { key: "self", label: formType === "pre_visit" ? "직접 전초" : "직접 관리" },
                { key: "other", label: "다른 사람 연결" },
              ].map((opt) => (
                <button key={opt.key} type="button" onClick={() => setForm((f) => ({ ...f, pre_visit_type: opt.key }))}
                  className={`w-full text-left rounded-lg border p-2.5 text-sm ${
                    form.pre_visit_type === opt.key ? "border-blue-400 bg-blue-50" : "border-gray-200"
                  }`}>{opt.label}</button>
              ))}
              {form.pre_visit_type === "other" && (
                <input type="text" placeholder="이름" value={form.other_name}
                  onChange={(e) => setForm((f) => ({ ...f, other_name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              )}
            </div>
          )}

          {/* 강의 강의자 */}
          {formType === "lecture" && (
            <input type="text" placeholder="강의자 이름" value={form.instructor_name}
              onChange={(e) => setForm((f) => ({ ...f, instructor_name: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          )}

          {/* 개인일정 제목 */}
          {formType === "personal" && (
            <input type="text" placeholder="제목" value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          )}

          {/* 행사 */}
          {formType === "group" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm((f) => ({ ...f, group_mode: "new" }))}
                  className={`py-2 rounded-lg border text-sm ${form.group_mode === "new" ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                  새로 만들기
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, group_mode: "existing" }))}
                  className={`py-2 rounded-lg border text-sm ${form.group_mode === "existing" ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                  기존 행사
                </button>
              </div>
              {form.group_mode === "new" && (
                <>
                  <input type="text" placeholder="행사 이름 (예: 노방, 동아리)" value={form.new_group_name}
                    onChange={(e) => setForm((f) => ({ ...f, new_group_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  <div>
                    <p className="text-xs text-gray-500 mb-1">공유 멤버</p>
                    <div className="flex gap-2">
                      <input type="text" placeholder="이름 입력" value={form.member_input}
                        onChange={(e) => setForm((f) => ({ ...f, member_input: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMember())}
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                      <button type="button" onClick={addMember} className="text-xs bg-blue-600 text-white px-3 rounded-lg">추가</button>
                    </div>
                    {form.members.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {form.members.map((m, i) => (
                          <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                            {m} <button onClick={() => removeMember(i)} className="text-blue-400 hover:text-red-400">×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {form.group_mode === "existing" && (
                <select value={form.group_id} onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="">행사 선택</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
              <input type="text" placeholder="일정 제목" value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
            </div>
          )}

          {/* 공통: 날짜/시간/장소/메모 */}
          {formType && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <input type="text" placeholder="장소" value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              <textarea placeholder="메모" value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              {/* 공유 대상 (행사 제외) */}
              {formType !== "group" && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">공유 대상 (선택)</p>
                  <div className="flex gap-2">
                    <input type="text" placeholder="이름 입력" value={form.share_input}
                      onChange={(e) => setForm((f) => ({ ...f, share_input: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && form.share_input.trim()) {
                          e.preventDefault();
                          setForm((f) => ({ ...f, shared_with: [...f.shared_with, f.share_input.trim()], share_input: "" }));
                        }
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none" />
                    <button type="button" onClick={() => {
                      if (form.share_input.trim()) setForm((f) => ({ ...f, shared_with: [...f.shared_with, f.share_input.trim()], share_input: "" }));
                    }} className="text-xs bg-gray-200 text-gray-600 px-3 rounded-lg">추가</button>
                  </div>
                  {form.shared_with.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {form.shared_with.map((n, i) => (
                        <span key={i} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          {n} <button onClick={() => setForm((f) => ({ ...f, shared_with: f.shared_with.filter((_, idx) => idx !== i) }))} className="text-blue-400 hover:text-red-400">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button onClick={handleSave} disabled={!formType || saving}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "저장 중..." : "일정 추가"}
              </button>
            </>
          )}
        </div>
      )}

      {/* 일정 목록 */}
      {selectedEvents.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 text-center py-4">이 날짜에 일정이 없습니다.</p>
      )}

      {selectedEvents.map((e) => (
        <button key={e.id} onClick={() => openEventDetail(e)}
          className="w-full bg-white rounded-lg border border-gray-200 p-3 text-left hover:border-blue-300 transition-colors">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLORS[e.type]}`} />
            <span className="text-sm font-medium">{e.title}</span>
            {e.purpose && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{PURPOSE_LABELS[e.purpose]}</span>}
            {e.life_name && <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded">{e.life_name}</span>}
            {e.group_name && <span className="text-[10px] bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded">{e.group_name}</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            {e.time && <span>{e.time}</span>}
            {e.location && <span>· {e.location}</span>}
          </div>
          {e.memo && <p className="text-xs text-gray-400 mt-1">{e.memo}</p>}
        </button>
      ))}

      {/* 일정 상세 모달 */}
      {viewingEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => { setViewingEvent(null); setEditingEvent(false); }}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {!editingEvent ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${TYPE_COLORS[viewingEvent.type]}`} />
                    <h3 className="text-base font-bold">{viewingEvent.title}</h3>
                  </div>
                  <button onClick={() => { setViewingEvent(null); setEditingEvent(false); }} className="text-gray-400 text-lg">×</button>
                </div>

                <div className="space-y-3">
                  {viewingEvent.purpose && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12">목적</span>
                      <span className="text-sm">{PURPOSE_LABELS[viewingEvent.purpose] || viewingEvent.purpose}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-12">날짜</span>
                    <span className="text-sm">{viewingEvent.date}</span>
                  </div>
                  {viewingEvent.time && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12">시간</span>
                      <span className="text-sm">{viewingEvent.time}</span>
                    </div>
                  )}
                  {viewingEvent.location && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12">장소</span>
                      <span className="text-sm">{viewingEvent.location}</span>
                    </div>
                  )}
                  {viewingEvent.life_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12">생명</span>
                      <button onClick={() => { setViewingEvent(null); if (viewingEvent.life_id) router.push(`${basePath}/life/${viewingEvent.life_id}`); }}
                        className="text-sm text-blue-600 underline">{viewingEvent.life_name}</button>
                    </div>
                  )}
                  {viewingEvent.group_name && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-12">행사</span>
                      <span className="text-sm">{viewingEvent.group_name}</span>
                    </div>
                  )}
                  {viewingEvent.memo && (
                    <div>
                      <span className="text-xs text-gray-400">메모</span>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{viewingEvent.memo}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  <button onClick={async () => {
                    if (viewingEvent?.type === "appointment") {
                      const { data } = await supabase.from("appointments").select("shared_with, instructor_name, purpose").eq("id", viewingEvent.id).single();
                      setEditForm(f => ({
                        ...f, shared_with: data?.shared_with || [], share_input: "",
                        purpose: data?.purpose || "", instructor_name: data?.instructor_name || "",
                        pre_visit_type: "", other_name: "",
                      }));
                    } else if (viewingEvent?.type === "personal") {
                      const { data } = await supabase.from("personal_events").select("shared_with").eq("id", viewingEvent.id).single();
                      setEditForm(f => ({ ...f, shared_with: data?.shared_with || [], share_input: "" }));
                    }
                    setEditingEvent(true);
                  }}
                    className="flex-1 rounded-lg border border-blue-300 py-2.5 text-sm font-medium text-blue-600 hover:bg-blue-50">수정</button>
                  <button onClick={() => { handleDelete(viewingEvent); setViewingEvent(null); }}
                    className="rounded-lg border border-red-200 px-4 py-2.5 text-sm text-red-400 hover:bg-red-50">삭제</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold mb-3">일정 수정</h3>
                <div className="space-y-3">
                  {/* 약속: 목적 버튼 (제목 대신) */}
                  {viewingEvent?.type === "appointment" ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">목적</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[["pre_visit", "전초"], ["management", "관리"], ["lecture", "강의"]].map(([val, label]) => (
                            <button key={val} type="button" onClick={() => setEditForm(f => ({ ...f, purpose: val, instructor_name: val !== f.purpose ? "" : f.instructor_name, pre_visit_type: "", other_name: "" }))}
                              className={`py-2 rounded-lg border text-sm font-medium ${editForm.purpose === val ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"}`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {(editForm.purpose === "pre_visit" || editForm.purpose === "management") && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">담당</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[["manager", "관리자 연결"], ["self", "직접"], ["other", "다른 사람"]].map(([key, label]) => (
                              <button key={key} type="button" onClick={() => setEditForm(f => ({ ...f, pre_visit_type: key }))}
                                className={`py-2 rounded-lg border text-xs font-medium ${editForm.pre_visit_type === key ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                                {label}
                              </button>
                            ))}
                          </div>
                          {editForm.pre_visit_type === "other" && (
                            <input type="text" placeholder="이름 입력" value={editForm.other_name} onChange={(e) => setEditForm(f => ({ ...f, other_name: e.target.value }))}
                              className="w-full mt-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                          )}
                        </div>
                      )}
                      {editForm.purpose === "lecture" && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">강의자</p>
                          <input type="text" value={editForm.instructor_name} onChange={(e) => setEditForm(f => ({ ...f, instructor_name: e.target.value }))}
                            placeholder="강의자 이름" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <input type="text" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="제목" className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none" />
                  )}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">날짜</label>
                    <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">시간</label>
                    <input type="time" value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none" />
                  </div>
                  <input type="text" placeholder="장소 (선택)" value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none" />
                  <textarea placeholder="메모 (선택)" value={editForm.memo} onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))} rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none resize-none" />

                  {/* 공유 대상 */}
                  {(viewingEvent?.type === "appointment" || viewingEvent?.type === "personal") && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">공유 대상</p>
                      {editForm.shared_with.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {editForm.shared_with.map((name) => (
                            <span key={name} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                              {name}
                              <button onClick={() => setEditForm(f => ({ ...f, shared_with: f.shared_with.filter(n => n !== name) }))} className="text-blue-400">✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input type="text" placeholder="이름 입력" value={editForm.share_input}
                          onChange={(e) => setEditForm(f => ({ ...f, share_input: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const v = editForm.share_input.trim();
                              if (v && !editForm.shared_with.includes(v)) setEditForm(f => ({ ...f, shared_with: [...f.shared_with, v], share_input: "" }));
                            }
                          }}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                        <button onClick={() => {
                          const v = editForm.share_input.trim();
                          if (v && !editForm.shared_with.includes(v)) setEditForm(f => ({ ...f, shared_with: [...f.shared_with, v], share_input: "" }));
                        }} className="text-sm bg-gray-200 px-3 py-2 rounded-lg">추가</button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleEditSave} disabled={saving}
                      className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                      {saving ? "저장 중..." : "수정 완료"}
                    </button>
                    <button onClick={() => { setViewingEvent(null); setEditingEvent(false); }} className="px-4 py-2.5 text-sm text-gray-500 border border-gray-300 rounded-lg">취소</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 그룹 관리 */}
      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <button onClick={() => setShowGroupManager(!showGroupManager)}
          className="w-full flex items-center justify-between text-sm font-medium text-gray-700">
          <span>그룹 ({groups.length})</span>
          <span className="text-xs text-gray-400">{showGroupManager ? "접기" : "펼치기"}</span>
        </button>

        {showGroupManager && (
          <div className="mt-3 space-y-2">
            {groups.map((g) => (
              <div key={g.id} className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={g.is_visible}
                    onChange={(e) => toggleGroupVisibility(g.id, e.target.checked)}
                    className="w-4 h-4 accent-blue-600" />
                  <span className={`w-2 h-2 rounded-full bg-orange-400`} />
                  {g.name}
                </label>
                <button onClick={() => leaveGroup(g.id)} className="text-[10px] text-gray-400 hover:text-red-400">해제</button>
              </div>
            ))}

            {/* 그룹 검색/연결 */}
            <div className="flex gap-2 mt-2">
              <input type="text" placeholder="그룹 검색" value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchGroups()}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-none" />
              <button onClick={searchGroups} className="text-xs bg-blue-600 text-white px-3 rounded-lg">검색</button>
            </div>
            {searchedGroups.map((g) => (
              <button key={g.id} onClick={() => joinGroup(g.id)}
                className="w-full text-left text-sm bg-gray-50 rounded-lg border border-gray-200 p-2 hover:border-blue-300">
                {g.name} <span className="text-xs text-blue-500">연결</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
