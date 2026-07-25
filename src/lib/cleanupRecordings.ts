// 음성 일지 오디오(recordings 버킷) 보관 정책: 최대 N일(기본 7) 후 삭제.
// 성공 전사분은 process-queue가 이미 지우므로, 여기선 실패·고아 파일까지 안전하게 정리.
import type { SupabaseClient } from "@supabase/supabase-js";

interface FileItem { path: string; createdAt: string | null }

// 버킷을 재귀적으로 훑어 모든 파일(경로·생성일) 수집
async function listAll(sb: SupabaseClient, bucket: string, prefix: string, out: FileItem[], depth = 0) {
  if (depth > 4) return; // 안전장치
  let offset = 0;
  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error || !data || data.length === 0) break;
    for (const item of data as { name: string; id: string | null; created_at?: string }[]) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) await listAll(sb, bucket, path, out, depth + 1); // 폴더
      else out.push({ path, createdAt: item.created_at ?? null });
    }
    if (data.length < 100) break;
    offset += 100;
  }
}

export async function cleanupOldRecordings(sb: SupabaseClient, days = 7): Promise<{ total: number; removed: number }> {
  const files: FileItem[] = [];
  await listAll(sb, "recordings", "", files);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const old = files.filter((f) => f.createdAt && new Date(f.createdAt).getTime() < cutoff).map((f) => f.path);

  let removed = 0;
  for (let i = 0; i < old.length; i += 100) {
    const chunk = old.slice(i, i + 100);
    const { error } = await sb.storage.from("recordings").remove(chunk);
    if (!error) removed += chunk.length;
  }
  // 삭제된 파일을 참조하던 audio_queue 항목의 audio_url 정리(재다운로드 시도 방지)
  if (removed > 0) {
    const cutoffIso = new Date(cutoff).toISOString();
    await sb.from("audio_queue").update({ audio_url: null }).lt("created_at", cutoffIso).not("audio_url", "is", null);
  }
  return { total: files.length, removed };
}
