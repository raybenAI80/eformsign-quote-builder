// 운영 배포 반영 확인: main 병합 커밋의 GitHub commit status "Vercel" 이 success 가 될 때까지 기다린 뒤,
// 운영 index.html 이 가리키는 JS 번들에 이번 변경의 고유 문자열이 들어 있는지 확인한다. 하나라도 어긋나면 exit 1.
//
// 실행: node tools/check-prod-deploy.mjs --sha <병합 커밋(또는 HEAD·origin/main)> --expect "<문자열>" [--expect "<문자열>" ...]
//        [--url https://eformsign-quote-builder-liart.vercel.app] [--context Vercel] [--interval 15] [--timeout 600]
//   --interval 폴링 간격(초, 기본 15), --timeout 최대 대기(초, 기본 600). gh CLI 로그인이 필요하다.
//   고유 문자열은 이번 변경이 번들에 남기는 UI 문구가 좋다(식별자는 번들 최소화로 바뀐다).
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const optAll = name => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : []));

const shaArg = opt('sha');
const expects = optAll('expect');
const URL_BASE = (opt('url', 'https://eformsign-quote-builder-liart.vercel.app')).replace(/\/$/, '');
const CONTEXT = opt('context', 'Vercel');
const INTERVAL = Number(opt('interval', '15')) * 1000;
const TIMEOUT = Number(opt('timeout', '600')) * 1000;

if (!shaArg || expects.length === 0) {
  console.error('사용법: node tools/check-prod-deploy.mjs --sha <커밋> --expect "<문자열>" [--expect ...] [--url <운영 주소>]');
  process.exit(2);
}

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' });
const sha = git('rev-parse', shaArg);
console.log(`커밋 ${sha.slice(0, 7)} (${git('log', '-1', '--format=%s', sha)})`);

async function vercelState() {
  const j = JSON.parse(gh('api', `repos/{owner}/{repo}/commits/${sha}/status`));
  const s = j.statuses.find(x => x.context === CONTEXT);
  return s ? { state: s.state, description: s.description } : null;
}

const t0 = Date.now();
let status = null;
for (;;) {
  try { status = await vercelState(); } catch (e) { console.error('gh 호출 실패:', String(e.message).split('\n')[0]); process.exit(1); }
  const sec = Math.round((Date.now() - t0) / 1000);
  console.log(`[${sec}s] status ${CONTEXT}: ${status ? `${status.state} (${status.description ?? ''})` : '(아직 없음)'}`);
  if (status?.state === 'success') break;
  if (status && (status.state === 'failure' || status.state === 'error')) { console.error(`배포 실패: ${status.state}`); process.exit(1); }
  if (Date.now() - t0 + INTERVAL > TIMEOUT) { console.error(`시간 초과: ${TIMEOUT / 1000}초 안에 ${CONTEXT} status 가 success 가 되지 않음`); process.exit(1); }
  await new Promise(r => setTimeout(r, INTERVAL));
}

const get = async u => {
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${u} → HTTP ${r.status}`);
  return r.text();
};

let html;
try { html = await get(URL_BASE + '/'); } catch (e) { console.error(e.message); process.exit(1); }
const bundles = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]))];
if (bundles.length === 0) { console.error('운영 index.html 에서 /assets/*.js 번들 경로를 찾지 못함'); process.exit(1); }
console.log('번들:', bundles.join(', '));

const texts = {};
for (const b of bundles) texts[b] = await get(URL_BASE + b);

let fail = 0;
console.log('\n| 기대 문자열 | 결과 | 번들 |\n|---|---|---|');
for (const e of expects) {
  const hit = bundles.find(b => texts[b].includes(e));
  console.log(`| ${e} | ${hit ? 'FOUND' : 'MISSING'} | ${hit ?? '-'} |`);
  if (!hit) fail++;
}
if (fail) { console.error(`\n${fail}건이 운영 번들에 없음 — 반영됐다고 보고하지 않는다.`); process.exit(1); }
console.log('\nOK 운영 번들에 모두 반영됨');
