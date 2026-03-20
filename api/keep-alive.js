/**
 * Supabase 무료 플랜 자동 정지 방지 크론 핸들러
 * ─────────────────────────────────────────────
 * Supabase 무료 플랜은 7일간 API 요청이 없으면 프로젝트가 자동 정지됩니다.
 * 이 핸들러를 Vercel Cron으로 5일마다 실행하면 프로젝트가 절대 꺼지지 않습니다.
 *
 * 사용법 (어떤 프로젝트든 복사해서 쓰세요):
 * 1. 이 파일을 api/cron.js 로 복사
 * 2. vercel.json 에 크론 설정 추가:
 *    { "crons": [{ "path": "/api/cron", "schedule": "0 0 */5 * *" }] }
 * 3. Vercel 환경변수에 SUPABASE_URL, SUPABASE_ANON_KEY 설정
 *    (VITE_ 접두사 붙은 변수도 자동으로 fallback 지원)
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' });
  }

  const supabase = createClient(url, key);
  const { error } = await supabase.from('_keepalive').select('count').limit(1);

  // 테이블이 없어도 OK — 쿼리 시도 자체가 프로젝트를 깨워줌
  return res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    note: error ? 'pinged (table not found is fine)' : 'pinged successfully',
  });
}
