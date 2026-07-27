"use client";

// 행사 상세에서 "이름만으로 추가"돼 만들어진 미가입 관리자(placeholder) 관리 화면.
// 강사식으로 백엔드 데이터만 있는 사람들이라, 성을 빼거나 다르게 입력해 같은 사람이 여러 개
// 생길 수 있다. 여기서 어디에 배정돼 있는지 보고, 중복을 하나로 "합치기(merge)"하거나
// 이름 수정·삭제할 수 있다. 합치면 담당(manager_id)·event_members 배정이 전부 대상으로 옮겨진다.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Placeholder {
  id: string;
  name: string;
  display_name: string;
  created_at: string;
  attendeeCount: number; // 이 사람이 담당(manager)인 참가자 수
  events: string[]; // 배정된(담당 또는 멤버) 행사 이름들
}

interface UserOpt {
  id: string;
  display_name: string;
  is_placeholder: boolean;
}

// 이름 비교용 정규화 (공백 제거)
const nk = (s: string) => s.replace(/\s+/g, "");

export default function PlaceholderManagerAdmin() {
  const [list, setList] = useState<Placeholder[]>([]);
  const [allUsers, setAllUsers] = useState<UserOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mergeFrom, setMergeFrom] = useState<Placeholder | null>(null);
  const [mergeSearch, setMergeSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: phs } = await supabase
      .from("users")
      .select("id, name, display_name, created_at")
      .eq("is_placeholder", true)
      .order("name");
    const phList = (phs || []) as { id: string; name: string; display_name: string; created_at: string }[];
    const ids = phList.map((p) => p.id);

    const attByMgr: Record<string, number> = {};
    const evByUser: Record<string, Set<string>> = {};
    if (ids.length) {
      const { data: atts } = await supabase.from("event_attendees").select("manager_id, events(name)").in("manager_id", ids);
      (atts || []).forEach((a: any) => {
        attByMgr[a.manager_id] = (attByMgr[a.manager_id] || 0) + 1;
        const nm = a.events?.name;
        if (nm) (evByUser[a.manager_id] = evByUser[a.manager_id] || new Set()).add(nm);
      });
      const { data: mems } = await supabase.from("event_members").select("user_id, events(name)").in("user_id", ids);
      (mems || []).forEach((m: any) => {
        const nm = m.events?.name;
        if (nm) (evByUser[m.user_id] = evByUser[m.user_id] || new Set()).add(nm);
      });
    }

    setList(
      phList.map((p) => ({
        ...p,
        attendeeCount: attByMgr[p.id] || 0,
        events: [...(evByUser[p.id] || [])],
      }))
    );

    const { data: us } = await supabase.from("users").select("id, display_name, is_placeholder").order("display_name");
    setAllUsers((us || []) as UserOpt[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // from(placeholder) → toId(대상 계정)로 합치기. 모든 배정을 대상으로 옮기고 placeholder 삭제.
  const doMerge = async (from: Placeholder, toId: string) => {
    if (from.id === toId || busy) return;
    setBusy(true);
    try {
      // 1) 참가자 담당(manager_id) 재배정
      await supabase.from("event_attendees").update({ manager_id: toId }).eq("manager_id", from.id);
      // 2) event_members: 대상이 이미 그 행사 멤버면 from 멤버십은 삭제, 아니면 user_id를 대상으로 변경
      const { data: fromMems } = await supabase.from("event_members").select("id, event_id").eq("user_id", from.id);
      const { data: toMems } = await supabase.from("event_members").select("event_id").eq("user_id", toId);
      const toEvents = new Set((toMems || []).map((m: any) => m.event_id));
      for (const m of (fromMems || []) as any[]) {
        if (toEvents.has(m.event_id)) await supabase.from("event_members").delete().eq("id", m.id);
        else await supabase.from("event_members").update({ user_id: toId }).eq("id", m.id);
      }
      // 3) 혹시 이 placeholder를 소속 단장(manager_id)으로 가진 사람이 있으면 재배정
      await supabase.from("users").update({ manager_id: toId }).eq("manager_id", from.id);
      // 4) placeholder 삭제
      await supabase.from("users").delete().eq("id", from.id);
      setMergeFrom(null);
      setMergeSearch("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const rename = async (p: Placeholder) => {
    const nm = prompt("이름 수정", p.display_name);
    if (nm == null) return;
    const t = nm.trim();
    if (!t) return;
    await supabase.from("users").update({ name: t, display_name: t }).eq("id", p.id);
    load();
  };

  const remove = async (p: Placeholder) => {
    if (!confirm(`"${p.display_name}" 미가입 관리자를 삭제할까요?\n담당으로 배정된 참가자 ${p.attendeeCount}명은 '담당 미배정'으로 바뀝니다.`)) return;
    setBusy(true);
    try {
      await supabase.from("event_attendees").update({ manager_id: null }).eq("manager_id", p.id);
      await supabase.from("event_members").delete().eq("user_id", p.id);
      await supabase.from("users").delete().eq("id", p.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-center text-sm text-gray-400 py-8">로딩 중...</p>;

  // 합치기 대상 후보: 검색어로 필터, 자기 자신 제외. 기본은 이름이 겹치는(부분일치) 후보를 위로.
  const mergeCandidates = (from: Placeholder) => {
    const q = nk(mergeSearch.trim());
    const fromKey = nk(from.name || from.display_name);
    return allUsers
      .filter((u) => u.id !== from.id)
      .filter((u) => !q || nk(u.display_name).includes(q))
      .map((u) => {
        const uk = nk(u.display_name);
        // 서로 이름이 포함관계면(성 빼고 등록 등) 유사도 높음
        const similar = uk && fromKey && (uk.includes(fromKey) || fromKey.includes(uk));
        return { u, similar };
      })
      .sort((a, b) => Number(b.similar) - Number(a.similar));
  };

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
        <p className="text-xs text-blue-800 font-medium">미가입 관리자 {list.length}명</p>
        <p className="text-[11px] text-blue-600 mt-1 leading-relaxed">
          행사에서 이름만으로 추가돼 아직 가입하지 않은 담당자예요. 본인이 같은 이름으로 회원가입하면 자동 연결됩니다.
          같은 사람이 다르게 입력돼 중복이면 <b>합치기</b>로 하나로 정리하세요.
        </p>
      </div>

      {list.length === 0 && <p className="text-center text-sm text-gray-400 py-6">미가입 관리자가 없습니다.</p>}

      {list.map((p) => (
        <div key={p.id} className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {p.display_name}
                <span className="ml-1.5 text-[10px] font-bold text-amber-600">미가입</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                담당 {p.attendeeCount}명
                {p.events.length > 0 && <span> · {p.events.join(", ")}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => { setMergeFrom(p); setMergeSearch(""); }}
                className="text-xs text-blue-600 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-50">합치기</button>
              <button onClick={() => rename(p)}
                className="text-xs text-gray-500 border border-gray-200 rounded-full px-2.5 py-1 hover:bg-gray-50">이름수정</button>
              <button onClick={() => remove(p)}
                className="text-gray-300 hover:text-red-400 text-sm px-1">✕</button>
            </div>
          </div>
        </div>
      ))}

      {/* 합치기 모달 */}
      {mergeFrom && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={() => { setMergeFrom(null); setMergeSearch(""); }}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">&quot;{mergeFrom.display_name}&quot; 합치기</h3>
              <button onClick={() => { setMergeFrom(null); setMergeSearch(""); }} className="text-xs text-gray-400">닫기</button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">
              이 사람을 누구로 합칠까요? 선택한 사람에게 담당·배정이 모두 옮겨지고, &quot;{mergeFrom.display_name}&quot;은(는) 삭제됩니다.
            </p>
            <input autoFocus value={mergeSearch} onChange={(e) => setMergeSearch(e.target.value)}
              placeholder="이름 검색" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-blue-400" />
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {mergeCandidates(mergeFrom).map(({ u, similar }) => (
                <button key={u.id} disabled={busy} onClick={() => doMerge(mergeFrom, u.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex items-center justify-between disabled:opacity-50">
                  <span>{u.display_name}</span>
                  <span className="flex items-center gap-1.5">
                    {similar && <span className="text-[10px] text-amber-600 font-medium">이름 비슷</span>}
                    {u.is_placeholder
                      ? <span className="text-[10px] text-gray-400">미가입</span>
                      : <span className="text-[10px] text-green-600">가입됨</span>}
                  </span>
                </button>
              ))}
              {mergeCandidates(mergeFrom).length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">대상이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
