-- journals 테이블에 소프트 삭제 컬럼 추가
-- Supabase SQL Editor에서 실행해주세요

ALTER TABLE journals ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
