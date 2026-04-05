"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

interface Event {
  id: string;
  name: string;
  type: "onetime" | "club";
  slug?: string;
  club_unit?: "daily" | "weekly";
  member_count: number;
}

interface UserChip {
  id: string;
  display_name: string;
}

interface EventListProps {
  basePath: string;
}

type Mode = "list" | "add-menu" | "create" | "join";

export default function EventList({ basePath }: EventListProps) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("list");

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<"onetime" | "club">("onetime");
  const [clubUnit, setClubUnit] = useState<"daily" | "weekly">("weekly");
  const [shareTargets, setShareTargets] = useState<UserChip[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserChip[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [menuEventId, setMenuEventId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const { data } = await supabase
      .from("event_members")
      .select("event_id, events(id, name, type, slug, club_unit)")
      .eq("user_id", user.id);

    if (data) {
      const eventList: Event[] = [];
      for (const em of data as any[]) {
        const ev = em.events;
        if (!ev) continue;
        // Get member count
        const { count } = await supabase
          .from("event_members")
          .select("*", { count: "exact", head: true })
          .eq("event_id", ev.id);
        eventList.push({ ...ev, member_count: count || 0 });
      }
      setEvents(eventList);
    }
    setLoading(false);
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

    // Reset and refresh
    setCreateName("");
    setCreateType("onetime");
    setClubUnit("weekly");
    setShareTargets([]);
    setMode("list");
    setCreating(false);
    fetchEvents();
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
      {mode === "list" && (
        <button
          onClick={() => setMode("add-menu")}
          className="w-full rounded-lg border-2 border-dashed border-gray-300 py-4 text-center text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          + 행사 추가
        </button>
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

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                setMode("list");
                setCreateName("");
                setShareTargets([]);
                setUserSearch("");
                setUserResults([]);
              }}
              className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={!createName.trim() || creating}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? "생성 중..." : "만들기"}
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

      {events.map((event) => (
        <div key={event.id} className="relative">
          <div className="flex bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
            <button
              onClick={() => router.push(`${basePath}/event/${event.id}`)}
              className="flex-1 p-4 text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-base">{event.name}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    event.type === "club"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {event.type === "club" ? "동아리" : "일회성"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">참여 {event.member_count}명</p>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuEventId(menuEventId === event.id ? null : event.id); }}
              className="px-3 flex items-center text-gray-300 hover:text-gray-500"
            >
              ⋯
            </button>
          </div>
          {menuEventId === event.id && (
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
