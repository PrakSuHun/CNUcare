"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { parseFiles, type ParsedImage, type ParsedSheet } from "@/lib/parseUpload";

interface Event {
  id: string;
  name: string;
  type: "onetime" | "club";
  slug?: string;
  club_unit?: "daily" | "weekly";
  event_date?: string | null;
  guest_count: number;
}

// 행사 날짜 → "yy.mm.dd"
function fmtEventDate(d?: string | null): string {
  if (!d) return "";
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1].slice(2)}.${m[2]}.${m[3]}` : "";
}

interface UserChip {
  id: string;
  display_name: string;
}

interface EventListProps {
  basePath: string;
  allEvents?: boolean; // 어도민: 참여 여부와 무관하게 모든 행사 표시
}

type Mode = "list" | "add-menu" | "create" | "join";

export default function EventList({ basePath, allEvents = false }: EventListProps) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createDate, setCreateDate] = useState(""); // 선택: 행사 날짜
  const [createType, setCreateType] = useState<"onetime" | "club">("onetime");
  const [orderMode, setOrderMode] = useState(false); // 순서 수정 모드
  const [orderBackup, setOrderBackup] = useState<Event[] | null>(null); // 취소용 스냅샷
  const [orderSaving, setOrderSaving] = useState(false);
  const [clubUnit, setClubUnit] = useState<"daily" | "weekly">("weekly");
  const [shareTargets, setShareTargets] = useState<UserChip[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserChip[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [menuEventId, setMenuEventId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 새 행사 만들 때 첨부하는 명단 파일 (이미지·엑셀) — 생성 후 참석자로 자동 추가
  const [rosterImages, setRosterImages] = useState<ParsedImage[]>([]);
  const [rosterSheets, setRosterSheets] = useState<ParsedSheet[]>([]);
  const [rosterParsing, setRosterParsing] = useState(false);
  const rosterFileRef = useRef<HTMLInputElement>(null);

  const onRosterFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setRosterParsing(true);
    try {
      const { images, sheets, skipped } = await parseFiles(files);
      setRosterImages((p) => [...p, ...images].slice(0, 6));
      setRosterSheets((p) => [...p, ...sheets].slice(0, 6));
      if (skipped.length) alert(`지원하지 않는 파일 제외: ${skipped.join(", ")} (이미지·엑셀·CSV만)`);
    } catch {
      alert("파일을 읽지 못했습니다.");
    } finally {
      setRosterParsing(false);
      if (rosterFileRef.current) rosterFileRef.current.value = "";
    }
  };

  // Join form state
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const user = getUser();

  useEffect(() => {
    if (user) fetchEvents();
  }, []);

  const fetchEvents = async () => {
    if (!user) return;
    // 어도민(allEvents)은 events 테이블에서 전부, 일반 사용자는 참여(event_members)한 것만
    let evs: any[] = [];
    if (allEvents) {
      const { data } = await supabase
        .from("events")
        .select("id, name, type, slug, club_unit, event_date")
        .order("name");
      evs = data || [];
    } else {
      const { data } = await supabase
        .from("event_members")
        .select("event_id, events(id, name, type, slug, club_unit, event_date)")
        .eq("user_id", user.id);
      evs = (data || []).map((em: any) => em.events).filter(Boolean);
    }

    const eventList: Event[] = [];
    for (const ev of evs) {
      // 참여 = 게스트(섭리회원이 아닌 신청자) 수
      const { count } = await supabase
        .from("event_attendees")
        .select("*", { count: "exact", head: true })
        .eq("event_id", ev.id)
        .eq("is_member", false);
      eventList.push({ ...ev, guest_count: count || 0 });
    }
    // 사용자별 저장된 표시 순서 적용
    const { data: ord } = await supabase.from("user_event_order").select("ordering").eq("user_id", user.id).maybeSingle();
    setEvents(applyOrder(eventList, (ord?.ordering as string[]) || []));
    setLoading(false);
  };

  // 저장된 순서(orderIds)대로 정렬. 목록에 없는 새 행사는 뒤에 붙임.
  const applyOrder = (list: Event[], orderIds: string[]): Event[] => {
    if (!orderIds.length) return list;
    const rank = new Map(orderIds.map((id, i) => [id, i]));
    return [...list].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Infinity;
      return ra - rb;
    });
  };

  // === 순서 수정 모드 (위/아래 버튼 → 저장) ===
  const enterOrderMode = () => { setOrderBackup([...events]); setOrderMode(true); };
  const cancelOrder = () => { if (orderBackup) setEvents(orderBackup); setOrderBackup(null); setOrderMode(false); };
  const moveEvent = (index: number, dir: -1 | 1) => {
    setEvents((prev) => {
      const to = index + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const saveOrder = async () => {
    if (!user) return;
    setOrderSaving(true);
    const ids = events.map((e) => e.id);
    await supabase.from("user_event_order").upsert(
      { user_id: user.id, ordering: ids, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    setOrderSaving(false);
    setOrderBackup(null);
    setOrderMode(false);
  };

  const handleUnlink = async (eventId: string) => {
    if (!user || !confirm("이 행사에서 나가시겠습니까?\n(행사 데이터는 삭제되지 않습니다)")) return;
    await supabase.from("event_members").delete().eq("event_id", eventId).eq("user_id", user.id);
    setMenuEventId(null);
    fetchEvents();
  };

  const handleDelete = async (eventId: string, eventName: string) => {
    if (!confirm(`"${eventName}" 행사를 완전히 삭제하시겠습니까?\n(모든 참석자, 출석, 피드백 데이터가 삭제됩니다)`)) return;
    await supabase.from("events").delete().eq("id", eventId);
    setMenuEventId(null);
    fetchEvents();
  };

  const handleUserSearch = (query: string) => {
    setUserSearch(query);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!query.trim()) {
      setUserResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("users")
        .select("id, display_name")
        .ilike("display_name", `%${query}%`)
        .limit(10);
      if (data) {
        setUserResults(
          data.filter(
            (u) =>
              u.id !== user?.id &&
              !shareTargets.some((t) => t.id === u.id)
          )
        );
      }
      setSearching(false);
    }, 300);
  };

  const addShareTarget = (target: UserChip) => {
    setShareTargets((prev) => [...prev, target]);
    setUserSearch("");
    setUserResults([]);
  };

  const removeShareTarget = (id: string) => {
    setShareTargets((prev) => prev.filter((t) => t.id !== id));
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      + "-" + Date.now().toString(36);
  };

  const handleCreate = async () => {
    if (!user || !createName.trim()) return;
    setCreating(true);

    const slug = createType === "club" ? generateSlug(createName) : null;

    const { data: newEvent, error } = await supabase
      .from("events")
      .insert({
        name: createName.trim(),
        type: createType,
        slug,
        club_unit: createType === "club" ? clubUnit : null,
        event_date: createDate || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error || !newEvent) {
      alert("행사 생성에 실패했습니다.");
      setCreating(false);
      return;
    }

    // Add creator as member
    const members = [
      { event_id: newEvent.id, user_id: user.id },
      ...shareTargets.map((t) => ({ event_id: newEvent.id, user_id: t.id })),
    ];

    await supabase.from("event_members").insert(members);

    // 첨부한 명단 파일(이미지·엑셀)이 있으면 → 참석자로 추출·삽입
    let importedCount = 0;
    if (rosterImages.length > 0 || rosterSheets.length > 0) {
      try {
        const res = await fetch("/api/extract-roster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: rosterImages.map((i) => ({ mime: i.mime, data: i.data })),
            sheets: rosterSheets.map((s) => ({ name: s.name, rows: s.rows, headers: s.headers })),
          }),
        });
        const { attendees } = await res.json();

        // 파일의 담당자(관리자) 이름 → CNUcare 유저 매칭 (완전일치 또는 성 제외 유일일치만; 애매·미존재는 미배정).
        // 기존 행사에 명단 추가할 때(EventDetail.handleRosterUpload)와 동일한 규칙.
        const nk = (s: unknown) => String(s ?? "").replace(/\s+/g, "").toLowerCase();
        const { data: userData } = await supabase.from("users").select("id, display_name");
        const allUsers = (userData || []) as { id: string; display_name: string }[];
        const resolveMgr = (q: unknown): { id: string; display_name: string } | null => {
          const key = nk(q);
          if (!key) return null;
          const exact = allUsers.filter((u) => nk(u.display_name) === key);
          if (exact.length === 1) return exact[0];
          if (exact.length > 1) return null; // 동명이인 → 애매
          const given = allUsers.filter((u) => nk(u.display_name).length >= 2 && nk(u.display_name).slice(1) === key);
          return given.length === 1 ? given[0] : null;
        };
        const matchedMgrs = new Map<string, string>(); // id -> display_name

        const rows: Record<string, unknown>[] = (attendees || []).filter((a: any) => a?.name).map((a: any) => {
          const mgr = a.manager ? resolveMgr(a.manager) : null;
          if (mgr) matchedMgrs.set(mgr.id, mgr.display_name);
          return {
            event_id: newEvent.id,
            name: String(a.name).trim(),
            gender: a.gender || null,
            department: a.department || null,
            year: Number.isFinite(a.year) ? a.year : null,
            phone: a.phone || null,
            school: a.school || null,
            friend_group: a.friendGroup || null,
            memo: a.memo || null,
            // 기본 항목에 없던 열은 커스텀 항목으로 보존
            custom_data: a.custom && Object.keys(a.custom).length ? a.custom : null,
            manager_id: mgr?.id || null,
            is_member: false,
            status: "pending",
          };
        });

        // 매칭된 관리자를 섭리회원 참석자로도 추가 (명단에 같은 이름이 아직 없을 때만)
        const attNames = new Set(rows.map((r) => nk(r.name)));
        for (const [id, dn] of matchedMgrs) {
          if (attNames.has(nk(dn))) continue;
          attNames.add(nk(dn));
          rows.push({
            event_id: newEvent.id,
            name: dn,
            gender: null, department: null, year: null, phone: null,
            school: null, friend_group: null, memo: null, custom_data: null,
            manager_id: null, is_member: true, status: "pending",
          });
        }

        if (rows.length) {
          await supabase.from("event_attendees").insert(rows);
          importedCount = rows.length;
        }

        // 매칭된 관리자를 행사 담당 목록(event_members)에도 반영 (생성자·공유대상은 이미 들어감)
        const existingMemberIds = new Set(members.map((m) => m.user_id));
        const newMgrMemberIds = [...matchedMgrs.keys()].filter((id) => !existingMemberIds.has(id));
        if (newMgrMemberIds.length) {
          await supabase.from("event_members").insert(newMgrMemberIds.map((id) => ({ event_id: newEvent.id, user_id: id })));
        }
      } catch {
        // 명단 추출 실패해도 행사는 생성됨 — 알림만
        alert("명단 파일 처리에 실패했어요. 행사는 만들어졌으니 상세에서 직접 추가해주세요.");
      }
    }

    // Reset and refresh
    setCreateName("");
    setCreateDate("");
    setCreateType("onetime");
    setClubUnit("weekly");
    setShareTargets([]);
    setRosterImages([]);
    setRosterSheets([]);
    setMode("list");
    setCreating(false);
    fetchEvents();
    if (importedCount > 0) {
      // 바로 행사로 이동해 확인
      router.push(`${basePath}/event/${newEvent.id}`);
    }
  };

  const handleJoin = async () => {
    if (!user || !joinName.trim()) return;
    setJoining(true);
    setJoinError("");

    const { data: found } = await supabase
      .from("events")
      .select("id, name")
      .eq("name", joinName.trim())
      .single();

    if (!found) {
      setJoinError("해당 이름의 행사를 찾을 수 없습니다.");
      setJoining(false);
      return;
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("event_members")
      .select("id")
      .eq("event_id", found.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      setJoinError("이미 참가 중인 행사입니다.");
      setJoining(false);
      return;
    }

    await supabase
      .from("event_members")
      .insert({ event_id: found.id, user_id: user.id });

    setJoinName("");
    setMode("list");
    setJoining(false);
    fetchEvents();
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400 text-sm">로딩 중...</div>;
  }

  return (
    <div className="space-y-3">
      {/* Add button / menu */}
      {mode === "list" && !orderMode && (
        <div>
          <button
            onClick={() => setMode("add-menu")}
            className="w-full rounded-lg border-2 border-dashed border-gray-300 py-4 text-center text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
          >
            + 행사 추가
          </button>
          {events.length > 1 && (
            <div className="mt-1.5">
              <button
                onClick={enterOrderMode}
                className="text-xs text-gray-500 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                순서 편집
              </button>
            </div>
          )}
        </div>
      )}

      {/* 순서 수정 모드 바 */}
      {orderMode && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="text-xs text-blue-700 flex-1">위/아래 버튼으로 순서를 바꾼 뒤 저장하세요</span>
          <button onClick={cancelOrder} className="text-xs text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5">취소</button>
          <button onClick={saveOrder} disabled={orderSaving} className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 font-medium disabled:opacity-50">
            {orderSaving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}

      {mode === "add-menu" && (
        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("create")}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              새 행사 만들기
            </button>
            <button
              onClick={() => setMode("join")}
              className="flex-1 bg-white text-blue-600 border border-blue-600 rounded-lg py-2.5 text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              기존 행사 참가
            </button>
          </div>
          <button
            onClick={() => setMode("list")}
            className="w-full text-xs text-gray-400 hover:text-gray-500 py-1"
          >
            취소
          </button>
        </div>
      )}

      {/* Create form */}
      {mode === "create" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">새 행사 만들기</h3>

          <div>
            <label className="text-xs text-gray-500 block mb-1">행사 이름</label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="행사 이름 입력"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">행사 날짜 <span className="text-gray-400">(선택)</span></label>
            <input
              type="date"
              value={createDate}
              onChange={(e) => setCreateDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            <p className="text-[11px] text-gray-400 mt-1">입력하면 목록에 <b>{createDate ? fmtEventDate(createDate) : "yy.mm.dd"} {createName || "행사명"}</b> 형태로 표시돼요.</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">유형</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCreateType("onetime")}
                className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                  createType === "onetime"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                일회성
              </button>
              <button
                onClick={() => setCreateType("club")}
                className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${
                  createType === "club"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
                }`}
              >
                동아리
              </button>
            </div>
          </div>

          {createType === "club" && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">출석 집계 단위</label>
              <select
                value={clubUnit}
                onChange={(e) => setClubUnit(e.target.value as "daily" | "weekly")}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              >
                <option value="weekly">1주일씩 집계</option>
                <option value="daily">회차당 집계</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">공유 대상</label>
            {shareTargets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {shareTargets.map((t) => (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full"
                  >
                    {t.display_name}
                    <button
                      onClick={() => removeShareTarget(t.id)}
                      className="text-blue-400 hover:text-blue-600 ml-0.5"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => handleUserSearch(e.target.value)}
                placeholder="이름으로 검색"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
              {userResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => addShareTarget(u)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {u.display_name}
                    </button>
                  ))}
                </div>
              )}
              {searching && (
                <div className="absolute right-3 top-2.5 text-xs text-gray-400">검색 중...</div>
              )}
            </div>
          </div>

          {/* 명단 파일 업로드 (선택) — 다른 곳에서 받은 명단을 이미지·엑셀로 바로 추가 */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">명단 파일 (선택)</label>
            <input
              ref={rosterFileRef}
              type="file"
              accept="image/*,.xlsx,.xls,.csv,.tsv"
              multiple
              onChange={(e) => onRosterFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => rosterFileRef.current?.click()}
              className="w-full border border-dashed border-gray-300 rounded-lg py-2.5 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
            >
              📎 이미지·엑셀로 명단 불러오기 {rosterParsing && "(읽는 중…)"}
            </button>
            <p className="text-[11px] text-gray-400 mt-1">캡처 이미지나 엑셀/CSV를 올리면 이름·연락처를 자동 추출해 참석자로 넣어요.</p>
            {(rosterImages.length > 0 || rosterSheets.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {rosterImages.map((img, i) => (
                  <span key={"ri" + i} className="flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 rounded-full pl-1 pr-2 py-0.5">
                    <img src={img.previewUrl} alt="" className="w-5 h-5 rounded object-cover" />
                    <span className="max-w-[90px] truncate">{img.name}</span>
                    <button type="button" onClick={() => setRosterImages((p) => p.filter((_, k) => k !== i))} className="text-gray-400">×</button>
                  </span>
                ))}
                {rosterSheets.map((s, i) => (
                  <span key={"rs" + i} className="flex items-center gap-1 text-[11px] bg-gray-50 border border-gray-200 rounded-full px-2 py-0.5">
                    📊 <span className="max-w-[110px] truncate">{s.name}</span>
                    <span className="text-gray-400">({s.rows.length}명)</span>
                    <button type="button" onClick={() => setRosterSheets((p) => p.filter((_, k) => k !== i))} className="text-gray-400">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setMode("list");
                setCreateName("");
                setShareTargets([]);
                setUserSearch("");
                setUserResults([]);
                setRosterImages([]);
                setRosterSheets([]);
              }}
              className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={!createName.trim() || creating || rosterParsing}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (rosterImages.length || rosterSheets.length ? "생성·명단 처리 중..." : "생성 중...") : "만들기"}
            </button>
          </div>
        </div>
      )}

      {/* Join form */}
      {mode === "join" && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">기존 행사 참가</h3>

          <div>
            <label className="text-xs text-gray-500 block mb-1">행사 이름 (정확히 입력)</label>
            <input
              type="text"
              value={joinName}
              onChange={(e) => {
                setJoinName(e.target.value);
                setJoinError("");
              }}
              placeholder="행사 이름 입력"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
            {joinError && (
              <p className="text-xs text-red-500 mt-1">{joinError}</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setMode("list");
                setJoinName("");
                setJoinError("");
              }}
              className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleJoin}
              disabled={!joinName.trim() || joining}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? "참가 중..." : "참가하기"}
            </button>
          </div>
        </div>
      )}

      {/* Event list */}
      {events.length === 0 && mode === "list" && (
        <p className="text-center text-sm text-gray-400 py-4">참여 중인 행사가 없습니다.</p>
      )}

      {events.map((event, idx) => (
        <div key={event.id} className="relative">
          <div className={`flex items-center bg-white rounded-lg border transition-colors ${orderMode ? "border-blue-200" : "border-gray-200 hover:border-blue-300"}`}>
            {/* 순서 수정 모드: 위/아래 버튼 */}
            {orderMode && (
              <div className="flex flex-col justify-center pl-2 gap-0.5">
                <button
                  onClick={() => moveEvent(idx, -1)}
                  disabled={idx === 0}
                  className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-sm leading-none px-1"
                  aria-label="위로"
                >▲</button>
                <button
                  onClick={() => moveEvent(idx, 1)}
                  disabled={idx === events.length - 1}
                  className="text-gray-400 hover:text-blue-600 disabled:opacity-20 text-sm leading-none px-1"
                  aria-label="아래로"
                >▼</button>
              </div>
            )}
            <button
              onClick={() => { if (!orderMode) router.push(`${basePath}/event/${event.id}`); }}
              className="flex-1 p-4 text-left min-w-0"
            >
              <p className="font-semibold text-base truncate">{event.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                참여 {event.guest_count}명
                {event.event_date && <span className="ml-2 text-gray-400">· {fmtEventDate(event.event_date)}</span>}
              </p>
            </button>
            {/* 라벨: ⋯ 왼쪽 + 세로 중앙 (원회원은 멤버십 — 라벨 없음) */}
            {event.name !== "원회원" && (
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                  event.type === "club"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {event.type === "club" ? "동아리" : "일회성"}
              </span>
            )}
            {!orderMode && (
              <button
                onClick={(e) => { e.stopPropagation(); setMenuEventId(menuEventId === event.id ? null : event.id); }}
                className="px-3 flex items-center text-gray-300 hover:text-gray-500"
              >
                ⋯
              </button>
            )}
          </div>
          {!orderMode && menuEventId === event.id && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuEventId(null)} />
              <div className="absolute right-2 top-12 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44">
                <button
                  onClick={() => handleUnlink(event.id)}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  연결 해제
                  <p className="text-[10px] text-gray-400">내 목록에서만 제거</p>
                </button>
                <button
                  onClick={() => handleDelete(event.id, event.name)}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                >
                  완전 삭제
                  <p className="text-[10px] text-red-300">모든 데이터 영구 삭제</p>
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
