"use client";

import { useEffect, useState } from "react";
import { getUser, logout, saveUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { formatPhone } from "@/lib/phone";
import { isIos, isStandalone, isSubscribed, pushSupported, subscribePush, unsubscribePush } from "@/lib/push";

// 헤더의 "설정" 버튼 + 모달. 계정정보 수정 / 알림 권한 / 로그아웃을 담는다.
export default function Settings() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-gray-400 hover:text-gray-600"
        aria-label="설정"
      >
        설정
      </button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  // 편집 취소 시 되돌릴 원래 값
  const [orig, setOrig] = useState({ name: "", phone: "" });

  useEffect(() => {
    const u = getUser();
    if (!u) { onClose(); return; }
    supabase
      .from("users")
      .select("name, display_name, phone")
      .eq("id", u.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const n = data.display_name || data.name || "";
          const p = formatPhone(data.phone || "");
          setName(n);
          setPhone(p);
          setOrig({ name: n, phone: p });
        }
        setLoading(false);
      });
  }, [onClose]);

  const handleSave = async () => {
    setMsg(null);
    const u = getUser();
    if (!u) return;

    if (!name.trim()) {
      setMsg({ type: "err", text: "이름을 입력해주세요." });
      return;
    }
    if (newPw || confirmPw) {
      if (newPw.length < 4) {
        setMsg({ type: "err", text: "비밀번호는 4자 이상으로 입력해주세요." });
        return;
      }
      if (newPw !== confirmPw) {
        setMsg({ type: "err", text: "새 비밀번호가 서로 일치하지 않습니다." });
        return;
      }
    }

    setSaving(true);
    const updates: Record<string, string> = {
      name: name.trim(),
      display_name: name.trim(),
      phone: phone.trim(),
    };
    if (newPw) updates.password = newPw;

    const { error } = await supabase.from("users").update(updates).eq("id", u.id);
    setSaving(false);

    if (error) {
      setMsg({ type: "err", text: "저장에 실패했습니다. 다시 시도해주세요." });
      return;
    }

    // 세션의 이름 갱신 → 헤더 등에 즉시 반영
    saveUser({ ...u, name: name.trim(), display_name: name.trim() });
    setNewPw("");
    setConfirmPw("");
    setOrig({ name: name.trim(), phone: phone.trim() });
    setEditing(false);
    setMsg({ type: "ok", text: "저장되었습니다." });
  };

  const cancelEdit = () => {
    setName(orig.name);
    setPhone(orig.phone);
    setNewPw("");
    setConfirmPw("");
    setMsg(null);
    setEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl overflow-y-auto"
        style={{ maxHeight: "90dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h2 className="text-base font-bold">설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="닫기">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">불러오는 중...</p>
        ) : (
          <div className="p-4 space-y-6">
            {/* 계정 정보 수정 — 버튼으로 열기, 저장해야 반영 */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">계정 정보</h3>
                {!editing && (
                  <button
                    onClick={() => { setMsg(null); setEditing(true); }}
                    className="text-xs text-blue-600 border border-blue-300 rounded-full px-3 py-1.5 hover:bg-blue-50"
                  >
                    계정 수정
                  </button>
                )}
              </div>

              {!editing ? (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
                  <div className="flex justify-between px-3 py-2.5">
                    <span className="text-gray-400">이름</span>
                    <span className="text-gray-700">{orig.name || "-"}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2.5">
                    <span className="text-gray-400">연락처</span>
                    <span className="text-gray-700">{orig.phone || "-"}</span>
                  </div>
                  {msg && msg.type === "ok" && (
                    <p className="text-xs text-blue-600 px-3 py-2">{msg.text}</p>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">이름</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">연락처</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      placeholder="010-0000-0000"
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-1">
                    <p className="text-xs text-gray-400 mb-1">비밀번호 변경 (바꿀 때만 입력)</p>
                    <input
                      type="password"
                      value={newPw}
                      placeholder="새 비밀번호"
                      autoComplete="new-password"
                      onChange={(e) => setNewPw(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none mb-2"
                    />
                    <input
                      type="password"
                      value={confirmPw}
                      placeholder="새 비밀번호 확인"
                      autoComplete="new-password"
                      onChange={(e) => setConfirmPw(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  {msg && (
                    <p className={`text-xs ${msg.type === "ok" ? "text-blue-600" : "text-red-500"}`}>{msg.text}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
                    >
                      {saving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </>
              )}
            </section>

            {/* 알림 권한 */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">알림 권한</h3>
              <NotificationRow />
            </section>

            {/* 로그아웃 */}
            <section className="pt-2 border-t border-gray-100">
              <button
                onClick={logout}
                className="w-full text-red-500 border border-red-200 rounded-lg py-2.5 text-sm font-medium hover:bg-red-50"
              >
                로그아웃
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// 알림 켜기/끄기 행 (라벨 + 상태 + 토글)
function NotificationRow() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (pushSupported()) isSubscribed().then(setOn);
    else if (isIos()) setOn(false); // iOS 미설치 → 켜기 유도
    else { setSupported(false); setOn(false); }
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (!on && isIos() && !isStandalone()) {
        alert("아이폰은 사파리 하단 공유 → '홈 화면에 추가' 후, 홈 화면의 CNUcare 아이콘으로 열어서 알림을 켜주세요.");
        return;
      }
      if (on) {
        await unsubscribePush();
        setOn(false);
      } else {
        const u = getUser();
        if (!u) throw new Error("로그인이 필요합니다.");
        await subscribePush(u.id, u.display_name || u.name);
        setOn(true);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-xs text-gray-400">이 기기(브라우저)에서는 알림이 지원되지 않습니다.</p>;
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
      <div>
        <p className="text-sm text-gray-700">푸시 알림</p>
        <p className="text-xs text-gray-400">약속 후 일지 미작성 · 행사 신청 알림</p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`text-sm font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
          on ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-300"
        }`}
      >
        {busy ? "…" : on ? "켜짐 🔔" : "꺼짐 🔕"}
      </button>
    </div>
  );
}
