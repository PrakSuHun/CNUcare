// 연락처를 하이픈(-) 포함 형식으로 통일한다.
// 입력 중에도 호출 가능(부분 입력이면 부분 포맷 반환).
//  - 010-1234-5678 (휴대폰 11자리)
//  - 010-123-4567  (10자리)
//  - 02-123-4567 / 02-1234-5678 (서울 지역번호)
//  - 031-123-4567 등 (3자리 국번)
export function formatPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;

  // 서울(02) 지역번호
  if (d.startsWith("02")) {
    if (d.length <= 5) return `${d.slice(0, 2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`;
    return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6, 10)}`;
  }

  // 010/011/031/070 등 3자리 국번
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

// 숫자(공백·하이픈 포함)로만 된 값일 때만 포맷한다.
// 연락처 칸에 인스타 아이디·메모("? " 등)를 적는 경우가 있어 그런 값은 그대로 둔다.
export function formatPhoneIfNumeric(raw: string): string {
  const t = (raw || "").trim();
  if (!t || !/^[\d\s-]+$/.test(t)) return t;
  return formatPhone(t);
}
