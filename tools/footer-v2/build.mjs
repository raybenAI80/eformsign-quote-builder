// footer-v2 시안 빌드 + 캡처 + 측정 (스크래치용). 실행: node build.mjs
import { makeFeet } from './feet.mjs';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
// 입력: tools/footer-v2/{base.css,foot.css,body.html} + 저장소 public/ 자산. 산출: docs/design-mode/footer-v2/(variants.html, f*.png), 중간 파일은 .work/footer-v2/.
// base.css = 푸터 개편 직전(커밋 1509889)의 quotePreviewD.css 사본, foot.css = 시안 푸터 스타일.
const ROOT = resolve(DIR, '..', '..');
const OUT = join(ROOT, 'docs', 'design-mode', 'footer-v2');
const WORK = join(ROOT, '.work', 'footer-v2');
mkdirSync(OUT, { recursive: true });
mkdirSync(WORK, { recursive: true });
const PUB = '../../../public'; // OUT 에서 public/ 으로 가는 상대 경로
const feet = makeFeet(PUB);
const css = readFileSync(join(DIR, 'base.css'), 'utf8');
const extra = readFileSync(join(DIR, 'foot.css'), 'utf8');


const VARIANTS = [
  { id: 'current', label: '현재', name: '배지 + 강점 이미지 (지금 출력물)' },
  { id: 'f1', label: 'F1', name: '콜로폰 — 절제된 활자형' },
  { id: 'f2', label: 'F2', name: '브랜드 밴드 — 슬라이드 1p 장면' },
  { id: 'f3', label: 'F3', name: '인증 원장 — 4p 내용 중심' },
];
const body = readFileSync(join(DIR, 'body.html'), 'utf8').replaceAll('src="assets/', `src="${PUB}/design-d/`);
const fonts = `
@font-face{font-family:"Pretendard";src:url("${PUB}/fonts/design-d/PretendardVariable.woff2") format("woff2-variations");font-weight:45 920;font-display:block}
@font-face{font-family:"Paperlogy";src:url("${PUB}/fonts/design-d/Paperlogy-6SemiBold.woff2") format("woff2");font-weight:600;font-display:block}
@font-face{font-family:"Paperlogy";src:url("${PUB}/fonts/design-d/Paperlogy-8ExtraBold.woff2") format("woff2");font-weight:800;font-display:block}`;
const papers = VARIANTS.map(v => `<div id="p-${v.id}" class="paper qd-paper" style="width:1123px">${body}${feet[v.id]}</div>`).join('\n');
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>견적서 푸터 시안 v2</title>
<style>${fonts}\n${css}\n${extra}\nbody{margin:0;background:#9aa3ab;padding:20px}.paper{margin:0 0 30px 0}</style></head><body>${papers}</body></html>`;
writeFileSync(join(OUT, 'variants.html'), html);

function loadPlaywright() {
  const home = process.env.USERPROFILE || '';
  const c = join(home, '.agent-harness', 'vendor', 'gstack', 'node_modules', 'playwright-core');
  if (!existsSync(c)) throw new Error('playwright-core 없음');
  return createRequire(import.meta.url)(c);
}
function findChrome() {
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const dirs = readdirSync(base).filter(d => /^chromium_headless_shell-\d+$/.test(d)).sort().reverse();
  for (const d of dirs) for (const sub of ['chrome-headless-shell-win64', 'chrome-win64']) {
    const exe = join(base, d, sub, 'chrome-headless-shell.exe');
    if (existsSync(exe)) return exe;
  }
}
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ executablePath: findChrome() });
const measure = {};
try {
  for (const dsf of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: dsf });
    await page.goto(pathToFileURL(join(OUT, 'variants.html')).href);
    await page.evaluate(async () => {
      for (const f of ['600 12px Paperlogy', '800 12px Paperlogy', '400 12px Pretendard', '600 12px Pretendard']) await document.fonts.load(f);
      await document.fonts.ready;
      await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
    });
    const ok = await page.evaluate(() => ['800 12px Paperlogy', '400 12px Pretendard'].every(f => document.fonts.check(f)));
    if (!ok) throw new Error('글꼴 로드 실패');
    for (const v of VARIANTS) {
      const el = page.locator(`#p-${v.id}`);
      const suffix = dsf === 2 ? '@2x' : '';
      if (dsf === 1) await el.screenshot({ path: join(OUT, `${v.id}.png`) });
      else await el.screenshot({ path: join(WORK, `${v.id}@2x.png`) });
      { const [pr, fr] = await el.evaluate(n => { const a = n.getBoundingClientRect(), f = n.querySelector('.qd-foot').getBoundingClientRect(); const sx = scrollX, sy = scrollY; return [{x:a.left+sx,y:a.top+sy,width:a.width}, {y:f.top+sy,height:f.height}]; });
        await page.screenshot({ path: join(WORK, `${v.id}-foot${suffix}.png`), fullPage: true, clip: { x: pr.x, y: fr.y, width: pr.width, height: fr.height } }); }
      if (dsf === 1) {
        measure[v.id] = await el.evaluate(n => {
          const paper = n.getBoundingClientRect();
          const foot = n.querySelector('.qd-foot');
          const fr = foot.getBoundingClientRect();
          const prevMin = n.style.minHeight; n.style.minHeight = '0';
          const natural = n.getBoundingClientRect().height; n.style.minHeight = prevMin;
          // 글자 크기: 푸터 안 텍스트 노드가 있는 요소의 computed font-size
          const sizes = []; const over = []; const outside = [];
          const walker = document.createTreeWalker(foot, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const t = walker.currentNode; if (!t.textContent.trim()) continue;
            const e = t.parentElement; const cs = getComputedStyle(e);
            sizes.push({ text: t.textContent.trim().slice(0, 18), px: parseFloat(cs.fontSize) });
            const r = document.createRange(); r.selectNodeContents(t); const rr = r.getBoundingClientRect();
            if (rr.left - paper.left < 52 - 0.5 || rr.right - paper.left > 1123 - 52 + 0.5) outside.push(t.textContent.trim().slice(0, 12));
          }
          foot.querySelectorAll('img').forEach(i => { const r = i.getBoundingClientRect(); if (r.left - paper.left < 52 - 0.5 || r.right - paper.left > 1123 - 52 + 0.5) outside.push('img:' + i.className); });
          foot.querySelectorAll('*').forEach(e => { if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline') over.push(e.className || e.tagName); });
          const minPx = Math.min(...sizes.map(s => s.px));
          const bigPx = Math.max(...sizes.map(s => s.px));
          const small = sizes.filter(s => s.px < 12).map(s => s.text);
          return { footHeight: Math.round(fr.height * 100) / 100, footTopInPaper: Math.round(fr.top - paper.top), footBottomGap: Math.round(paper.bottom - fr.bottom), pageHeight: Math.round(paper.height * 100) / 100, naturalHeight: Math.round(natural * 100) / 100, minFontPx: minPx, maxFontPx: bigPx, under12: small, outsideMargins: outside, overflowEls: over };
        });
      }
    }
    await page.close();
  }
} finally { await browser.close(); }
writeFileSync(join(WORK, 'measure.json'), JSON.stringify(measure, null, 1));
console.log(JSON.stringify(measure, null, 1));
