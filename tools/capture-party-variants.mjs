// 공급사·고객사·담당자 블록 수정 시안 캡처.
// 입력: docs/design-mode/party-block/variants.html (각 시안 = #slice-<id>)
// 출력(같은 폴더): current.png v1.png v2.png v3.png v4.png (실제 크기 1123px 폭) + sheet-scaled.png (0.69배, 2열)
// 실행: node tools/capture-party-variants.mjs
// Playwright: 저장소에 의존성이 없으므로 PLAYWRIGHT_CORE 환경변수 또는 아래 후보 경로의 playwright-core 를 쓴다.
// 브라우저: PLAYWRIGHT_CHROME 환경변수 또는 ms-playwright 의 chromium 중 가장 최신 것.
import { createRequire } from 'node:module';
import { existsSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'docs', 'design-mode', 'party-block');
const SCALE = 0.69; // PDF: 가로 1123px 견적서를 A4 세로(210mm ≈ 794px)로 줄이는 비율
const VARIANTS = [
  { id: 'current', label: '현재', name: '흰 바탕 · 1px 회색 선 · 세로 구분선' },
  { id: 'v1', label: '시안 1', name: '옅은 배경 카드' },
  { id: 'v2', label: '시안 2', name: '표 머리 띠' },
  { id: 'v3', label: '시안 3', name: '단일 박스 + 섹션 제목' },
  { id: 'v4', label: '시안 4', name: '위계 재배치 (고객사 강조)' },
];

function loadPlaywright() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    process.env.PLAYWRIGHT_CORE,
    join(ROOT, 'node_modules', 'playwright-core'),
    join(home, '.agent-harness', 'vendor', 'gstack', 'node_modules', 'playwright-core'),
    join(home, '.claude', 'skills', 'gstack', 'node_modules', 'playwright-core'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return createRequire(import.meta.url)(c);
  }
  throw new Error('playwright-core 를 찾지 못했다. PLAYWRIGHT_CORE 환경변수로 경로를 준다.');
}

function findChrome() {
  // chrome-headless-shell 을 쓴다(실제 Chrome 이 아니라 실행마다 새 Windows 프로필이 생기지 않는다).
  if (process.env.PLAYWRIGHT_CHROME) return process.env.PLAYWRIGHT_CHROME;
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dirs = readdirSync(base).filter(d => /^chromium_headless_shell-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) {
    for (const sub of ['chrome-headless-shell-win64', 'chrome-win64']) {
      const exe = join(base, d, sub, 'chrome-headless-shell.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return undefined;
}

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: findChrome() });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(join(DIR, 'variants.html')).href);
  await page.evaluate(async () => {
    await document.fonts.load('600 12px Paperlogy');
    await document.fonts.load('800 12px Paperlogy');
    await document.fonts.load('400 12px Pretendard');
    await document.fonts.load('600 12px Pretendard');
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  });
  const fontsOk = await page.evaluate(() => ['600 12px Paperlogy', '800 12px Paperlogy', '400 12px Pretendard', '600 12px Pretendard'].every(f => document.fonts.check(f)));
  if (!fontsOk) throw new Error('글꼴 로드 실패: public/fonts/design-d/ 경로를 확인한다.');

  const sizes = {};
  for (const v of VARIANTS) {
    const el = page.locator(`#slice-${v.id}`);
    await el.screenshot({ path: join(DIR, `${v.id}.png`) });
    sizes[v.id] = await el.evaluate(n => ({ w: n.offsetWidth, h: n.offsetHeight }));
  }

  // 0.69배 비교 시트: 칸 = 라벨 + 축소 이미지. 2열.
  const cw = Math.round(1123 * SCALE);
  const cells = VARIANTS.map(v => {
    const h = Math.round(sizes[v.id].h * SCALE);
    return `<figure><figcaption><b>${v.label}</b> ${v.name}</figcaption><img src="${v.id}.png" width="${cw}" height="${h}"></figure>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:"Pretendard";src:url("../../../public/fonts/design-d/Pretendard-Regular.woff2") format("woff2");font-weight:400}
@font-face{font-family:"Pretendard";src:url("../../../public/fonts/design-d/Pretendard-SemiBold.woff2") format("woff2");font-weight:600}
body{margin:0;padding:24px;background:#9aa3ab;font-family:"Pretendard",sans-serif;word-break:keep-all}
.g{display:grid;grid-template-columns:${cw}px ${cw}px;gap:28px 24px;align-items:start;width:${cw * 2 + 24}px}
figure{margin:0}figcaption{color:#fff;font-size:15px;margin-bottom:6px}figcaption b{font-weight:600;font-size:16px;margin-right:8px}
img{display:block;background:#fff}
</style><div class="g">${cells}</div>`;
  const tmp = join(DIR, '.sheet-tmp.html');
  writeFileSync(tmp, html);
  try {
    const p2 = await browser.newPage({ viewport: { width: cw * 2 + 72, height: 900 }, deviceScaleFactor: 1 });
    await p2.goto(pathToFileURL(tmp).href);
    await p2.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode())); });
    await p2.screenshot({ path: join(DIR, 'sheet-scaled.png'), fullPage: true });
  } finally {
    rmSync(tmp, { force: true });
  }
  console.log(JSON.stringify({ sizes, scale: SCALE }, null, 1));
} finally {
  await browser.close();
}
