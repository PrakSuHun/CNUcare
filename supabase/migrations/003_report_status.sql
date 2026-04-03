-- reports 테이블에 상태 + 분석 요청 데이터 컬럼 추가
-- Supabase SQL Editor에서 실행해주세요

ALTER TABLE reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS request_data jsonb;
