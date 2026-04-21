"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { autoUpdateStage, revertStageIfOrphaned } from "@/lib/autoStage";

interface Appointment {
  id: string;
  title: string;
  purpose: string | null;
  date: string;
  time: string | null;
  location: string | null;
  instructor_name: string | null;
  note: string | null;
  created_at: string;
}

interface AppointmentsProps {
  lifeId: string;
  readOnly?: boolean;
}

const PURPOSE_OPTIONS = [
  { value: "pre_visit", label: "전초" },
  { value: "management", label: "관리" },
  { value: "lecture", label: "강의" },
];

const PURPOSE_LABELS: Record<string, string> = {
  pre_visit: "전초",
  management: "관리",
  lecture: "강의",
};

const PURPOSE_COLORS: Record<string, string> = {
  pre_visit: "bg-orange-100 text-orange-700",
  management: "bg-blue-100 text-blue-700",
  lecture: "bg-purple-100 text-purple-700",
};

export default function Appointments({ lifeId, readOnly = false }: AppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managerName, setManagerName] = useState("");
  const [form, setForm] = useState({
    title: "",
    purpose: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
    location: "",
    instructor_name: "",
    pre_visit_type: "",  // manager / self / other
    other_name: "",
    note: "",
    shared_with: [] as string[],
    share_input: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAppointments();
    fetchManagerName();
  }, [lifeId]);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("life_id", lifeId)
      .order("date", { ascending: true });
    if (data) setAppointments(data);
    setLoading(false);
  };

  const fetchManagerName = async () => {
    const user = getUser();
    if (!user) return;
    // 현재 사용자의 manager_id 가져오기
    const { data: me } = await supabase
      .from("users")
      .select("manager_id")
      .eq("id", user.id)
      .single();
    if (!me?.manager_id) return;
    // 관리자 이름 가져오기
    const { data: mgr } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", me.manager_id)
      .single();
    if (mgr) setManagerName(mgr.display_name);
  };

  const resetForm = () => {
    setForm({
      title: "", purpose: "", date: new Date().toISOString().split("T")[0],
      time: "", location: "", instructor_name: "", pre_visit_type: "", other_name: "", note: "",
      shared_with: [], share_input: "",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (a: Appointment) => {
    // 전초 타입 역추론
    let preVisitType = "";
    if (a.purpose === "pre_visit") {
      if (a.instructor_name === managerName) preVisitType = "manager";
      else if (!a.instructor_name || a.instructor_name === getUser()?.display_name) preVisitType = "self";
      else preVisitType = "other";
    }

    setForm({
      title: a.title,
      purpose: a.purpose || "",
      date: a.date,
      time: a.time || "",
      location: a.location || "",
      instructor_name: a.instructor_name || "",
      pre_visit_type: preVisitType,
      other_name: preVisitType === "other" ? (a.instructor_name || "") : "",
      note: a.note || "",
      shared_with: (a as any).shared_with || [],
      share_input: "",
    });
    setEditingId(a.id);
    setShowForm(true);
  };

  const getAssigneeName = (): string | null => {
    if (form.purpose === "pre_visit" || form.purpose === "management") {
      if (form.pre_visit_type === "manager") return managerName;
      if (form.pre_visit_type === "other") return form.other_name || null;
      // self 또는 미선택 → 본인
      return getUser()?.display_name || null;
    }
    if (form.purpose === "lecture") return form.instructor_name || null;
    return null;
  };

  const handleSave = async () => {
    const user = getUser();
    if (!user || !form.date || !form.purpose) return;
    setSaving(true);

    const assignee = getAssigneeName();
    const autoTitle = form.title || (PURPOSE_LABELS[form.purpose] || form.purpose) + (assignee ? ` (${assignee})` : "");
    const data: any = {
      life_id: lifeId,
      title: autoTitle,
      purpose: form.purpose,
      date: form.date,
      time: form.time || null,
      location: form.location || null,
      instructor_name: assignee,
      note: form.note || null,
      shared_with: form.shared_with.length > 0 ? form.shared_with : [],
    };

    if (editingId) {
      await supabase.from("appointments").update(data).eq("id", editingId);
    } else {
      data.created_by = user.id;
      await supabase.from("appointments").insert(data);
    }

    // 담당자 이름이 있으면 매칭되는 사용자에게 일정 공유 (user_lives 연결)
    if (assignee) {
      const { data: matched } = await supabase
        .from("users")
        .select("id")
        .eq("display_name", assignee)
        .in("role", ["manager", "instructor", "leader"]);
      if (matched) {
        for (const m of matched) {
          await supabase.from("user_lives").upsert({
            user_id: m.id,
            life_id: lifeId,
            role_in_life: form.purpose === "lecture" ? "instructor" : "manager",
          }, { onConflict: "user_id,life_id" }).then(() => {});
        }
      }
    }

    // 전초 약속 → 단계 자동 변경
    if (form.purpose === "pre_visit") {
      await autoUpdateStage(lifeId, "pre_visit_connect");
    }

    resetForm();
    setSaving(false);
    fetchAppointments();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 약속을 삭제하시겠습니까?")) return;
    await supabase.from("appointments").delete().eq("id", id);
    await revertStageIfOrphaned(lifeId);
    fetchAppointments();
  };

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const isPast = (a: Appointment) => {
    if (a.date < today) return true;
    if (a.date === today && a.time && a.time < currentTime) return true;
    return false;
  };

  const upcoming = appointments.filter((a) => !isPast(a));
  const past = appointments.filter((a) => isPast(a));

  if (loading) return <p className="text-xs text-gray-400 text-center py-4">로딩 중...</p>;

  return (
    <div className="space-y-3">
      {!readOnly && (
        showForm ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold">{editingId ? "약속 수정" : "약속 추가"}</p>

            {/* 목적 선택 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">목적</label>
              <div className="grid grid-cols-3 gap-2">
                {PURPOSE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, purpose: opt.value, instructor_name: "", pre_visit_type: "", other_name: "" }))}
                    className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                      form.purpose === opt.value ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 전초 옵션 */}
            {form.purpose === "pre_visit" && (
              <div className="space-y-2">
                <label className="block text-xs text-gray-500">전초 방식</label>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, pre_visit_type: "manager" }))}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                    form.pre_visit_type === "manager" ? "border-blue-400 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <span className="font-medium">{managerName || "관리자"}</span> 연결
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, pre_visit_type: "self" }))}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                    form.pre_visit_type === "self" ? "border-blue-400 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  직접 전초
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, pre_visit_type: "other" }))}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                    form.pre_visit_type === "other" ? "border-blue-400 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  다른 사람 연결
                </button>
                {form.pre_visit_type === "other" && (
                  <input
                    type="text"
                    placeholder="이름 입력"
                    value={form.other_name}
                    onChange={(e) => setForm((f) => ({ ...f, other_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
                  />
                )}
              </div>
            )}

            {/* 관리 - 전초와 동일한 담당자 선택 */}
            {form.purpose === "management" && (
              <div className="space-y-2">
                <label className="block text-xs text-gray-500">담당</label>
                <button type="button" onClick={() => setForm((f) => ({ ...f, pre_visit_type: "manager" }))}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${form.pre_visit_type === "manager" ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                  <span className="font-medium">{managerName || "관리자"}</span> 연결
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, pre_visit_type: "self" }))}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${form.pre_visit_type === "self" ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                  직접 관리
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, pre_visit_type: "other" }))}
                  className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${form.pre_visit_type === "other" ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}>
                  다른 사람 연결
                </button>
                {form.pre_visit_type === "other" && (
                  <input type="text" placeholder="이름 입력" value={form.other_name}
                    onChange={(e) => setForm((f) => ({ ...f, other_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
                )}
              </div>
            )}

            {/* 강의 - 강의자 */}
            {form.purpose === "lecture" && (
              <input type="text" placeholder="강의자 이름" value={form.instructor_name}
                onChange={(e) => setForm((f) => ({ ...f, instructor_name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
            )}


            <div>
              <label className="block text-xs text-gray-500 mb-1">날짜</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">시간 (선택)</label>
              <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none" />
            </div>
            <input type="text" placeholder="장소 (선택)" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none" />
            <textarea placeholder="메모 (선택)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none resize-none" />

            {/* 공유 대상 */}
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
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                <button type="button" onClick={() => {
                  if (form.share_input.trim()) setForm((f) => ({ ...f, shared_with: [...f.shared_with, f.share_input.trim()], share_input: "" }));
                }} className="text-xs bg-gray-200 text-gray-600 px-3 rounded-lg">추가</button>
              </div>
              {form.shared_with.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.shared_with.map((name, i) => (
                    <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                      {name}
                      <button onClick={() => setForm((f) => ({ ...f, shared_with: f.shared_with.filter((_, idx) => idx !== i) }))}
                        className="text-blue-400 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={handleSave} disabled={!form.date || !form.purpose || saving}
                className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "저장 중..." : editingId ? "수정 완료" : "약속 추가"}
              </button>
              <button onClick={resetForm} className="px-4 py-2.5 text-sm text-gray-500 border border-gray-300 rounded-lg">취소</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowForm(true)}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-3 text-center text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors">
            + 약속 추가
          </button>
        )
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">등록된 약속이 없습니다.</p>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">예정 ({upcoming.length})</p>
          {upcoming.map((a) => (
            <div key={a.id} className="bg-white rounded-lg border border-blue-200 p-3 mb-2">
              <div className="flex items-start justify-between">
                <button
                  onClick={() => !readOnly && openEdit(a)}
                  className={`flex-1 text-left ${readOnly ? "cursor-default" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {a.purpose && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PURPOSE_COLORS[a.purpose] || "bg-gray-100"}`}>
                        {PURPOSE_LABELS[a.purpose] || a.purpose}
                      </span>
                    )}
                    <span className="text-sm font-medium">{a.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{a.date}</span>
                    {a.time && <span>{a.time}</span>}
                    {a.location && <span>· {a.location}</span>}
                  </div>
                  {a.instructor_name && (
                    <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded mt-1 inline-block">
                      {a.purpose === "lecture" ? "강사" : "담당"}: {a.instructor_name}
                    </span>
                  )}
                  {a.note && <p className="text-xs text-gray-400 mt-1">{a.note}</p>}
                </button>
                {!readOnly && (
                  <button onClick={() => handleDelete(a.id)} className="text-xs text-gray-300 hover:text-red-400 shrink-0 ml-2">삭제</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details>
          <summary className="text-xs text-gray-400 cursor-pointer">만료 ({past.length})</summary>
          <div className="mt-2 space-y-2">
            {past.map((a) => (
              <div key={a.id} className="bg-gray-50 rounded-lg border border-gray-200 p-3 opacity-60">
                <div className="flex items-center gap-2">
                  {a.purpose && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PURPOSE_COLORS[a.purpose] || "bg-gray-100"}`}>
                      {PURPOSE_LABELS[a.purpose]}
                    </span>
                  )}
                  <span className="text-sm">{a.title}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                  <span>{a.date}</span>
                  {a.time && <span>{a.time}</span>}
                  {a.instructor_name && <span>· {a.instructor_name}</span>}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
