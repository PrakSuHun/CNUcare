"use client";
// 관리자 행사 피드백 작성 페이지 (팝업 아닌 새 페이지).
// 이 행사에서 '내가 담당(manager_id)'인 참석자만 이름별로 파악내용/이성여부 작성 + 즉시 생명 전환.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { convertAttendeeToLife } from "@/lib/convertLife";

interface Att {
  id: string;
  name: string;
  department: string | null;
  year: number | null;
  gender: string | null;
  phone: string | null;
  assessment: string | null;
  opposite_sex: boolean | null;
  life_id: string | null;
}

export default function EventFeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [eventName, setEventName] = useState("");
  const [atts, setAtts] = useState<Att[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertIds, setConvertIds] = useState<Set<string>>(new Set()); // 전환 선택된 참석자(저장 시 전환)

  useEffect(() => {
    const u = getUser();
    if (!u) { router.replace(`/?next=${encodeURIComponent(`/event-feedback/${eventId}`)}`); return; }
    (async () => {
      const [ev, aRes, reqRes] = await Promise.all([
        supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
        supabase.from("event_attendees")
          .select("id, name, department, year, gender, phone, assessment, opposite_sex, life_id")
          .eq("event_id", eventId).eq("manager_id", u.id).eq("is_member", false).order("name"),
        supabase.from("event_feedback_requests").select("note").eq("event_id", eventId).eq("manager_id", u.id).maybeSingle(),
      ]);
      setEventName(ev.data?.name || "행사");
      setAtts((aRes.data as Att[]) || []);
      setNote(reqRes.data?.note || "");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const setField = (id: string, patch: Partial<Att>) =>
    setAtts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // 전환 선택 토글 (실제 전환은 저장 시)
  const toggleConvert = (id: string) =>
    setConvertIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const submit = async () => {
    const u = getUser();
    if (!u) return;
    setSaving(true);
    try {
      // 참석자별 파악내용/이성여부 저장 + 전환 선택된 사람만 실제 전환
      for (const a of atts) {
        await supabase.from("event_attendees")
          .update({ assessment: a.assessment || null, opposite_sex: a.opposite_sex ?? null })
          .eq("id", a.id);
        if (convertIds.has(a.id) && !a.life_id) {
          await convertAttendeeToLife({ attendee: a, primaryUserId: u.id, eventName, assessment: a.assessment });
        }
      }
      // 요청 완료 처리 (없으면 생성)
      await supabase.from("event_feedback_requests").upsert(
        { event_id: eventId, manager_id: u.id, status: "done", note: note || null, submitted_at: new Date().toISOString() },
        { onConflict: "event_id,manager_id" }
      );
      alert("피드백이 저장되었습니다. 감사합니다!");
      router.replace("/");
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    }
    setSaving(false);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><p className="text-gray-400 text-sm">불러오는 중…</p></div>;

  return (
    <div className="max-w-lg mx-auto p-4 pb-28">
      <div className="mb-4">
        <p className="text-xs text-gray-400">행사 피드백</p>
        <h1 className="text-lg font-bold text-gray-900">{eventName}</h1>
        <p className="text-xs text-gray-500 mt-1">내가 담당한 분들의 파악 내용을 작성해 주세요. 전환할 사람은 <b>‘생명 전환’</b>을 눌러 선택하면 저장할 때 전환돼요.</p>
      </div>

      {atts.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-10">이 행사에서 나에게 배정된 참석자가 없어요.</p>
      ) : (
        <div className="space-y-3">
          {atts.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-gray-900">{a.name}</span>
                {a.department && <span className="text-[11px] text-gray-400">{a.department}</span>}
                {a.life_id
                  ? <span className="ml-auto text-[11px] font-bold text-green-600 bg-green-50 rounded-full px-2 py-0.5">P · 전환완료</span>
                  : convertIds.has(a.id)
                    ? <span className="ml-auto text-[11px] font-bold text-green-600 bg-green-50 rounded-full px-2 py-0.5">P · 전환 예정</span>
                    : <span className="ml-auto text-[11px] font-bold text-red-500 bg-red-50 rounded-full px-2 py-0.5">F · 미전환</span>}
              </div>
              <textarea
                value={a.assessment || ""}
                onChange={(e) => setField(a.id, { assessment: e.target.value })}
                placeholder="파악 내용 (특이사항·MBTI·본가·연애 여부·작업 여부 등)"
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
              />
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!a.opposite_sex}
                  onChange={(e) => setField(a.id, { opposite_sex: e.target.checked })}
                  className="w-4 h-4 accent-blue-600"
                />
                <span className="text-sm text-gray-700">이성 여부 (연애 관계 주의 대상)</span>
              </label>
              <div className="mt-2 flex items-center justify-end gap-2">
                {a.life_id ? (
                  <span className="text-xs text-green-600 font-medium">생명 전환 완료</span>
                ) : (
                  <>
                    <span className="text-[11px] text-gray-400">저장 시 반영</span>
                    <button
                      onClick={() => toggleConvert(a.id)}
                      className={`text-xs rounded-lg px-3 py-1.5 font-medium border transition-colors ${
                        convertIds.has(a.id)
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-white text-gray-500 border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      {convertIds.has(a.id) ? "✓ 생명 전환" : "미전환"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}

          {/* 애로사항/건의 (선택) */}
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-700 mb-1">애로사항·건의 <span className="text-xs text-gray-400">(선택)</span></p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="전도하면서 어려웠던 점이나 건의할 내용을 자유롭게 적어주세요."
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}

      {/* 하단 고정 저장 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
        <div className="max-w-lg mx-auto flex gap-2">
          <button onClick={() => router.replace("/")} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-500 text-sm">나가기</button>
          <button onClick={submit} disabled={saving} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
            {saving ? "저장 중…" : "저장하고 완료"}
          </button>
        </div>
      </div>
    </div>
  );
}
