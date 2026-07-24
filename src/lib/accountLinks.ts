// 같은 사람이 쓰는 여러 계정을 묶어, 한 계정으로 가는 알림을 연결된 계정에도 함께 보낸다.
// key = user_id, value = 함께 알림 받을 다른 user_id 목록.
// (계정을 추가로 묶고 싶으면 아래 맵에 양방향으로 넣으면 됨)
export const ACCOUNT_LINKS: Record<string, string[]> = {
  // 박수훈(student, login: cnu) ↔ 관리자(admin) — 동일 인물, 알림 통합
  "a94425e7-f75e-4e4d-98e8-cbb8f4856045": ["0f0ba5cf-e219-458d-8188-e58bc5336534"],
  "0f0ba5cf-e219-458d-8188-e58bc5336534": ["a94425e7-f75e-4e4d-98e8-cbb8f4856045"],
};

// 주어진 user_id 목록에, 연결된 계정들을 더해 중복 없이 돌려준다.
export function expandLinkedUsers(userIds: string[]): string[] {
  const out = new Set(userIds);
  for (const id of userIds) {
    for (const linked of ACCOUNT_LINKS[id] || []) out.add(linked);
  }
  return [...out];
}
