// PNG 내보내기(exportToImage) 글자 위치 측정: 화면 DOM 의 글자 줄 상자(getBoundingClientRect)와
// 내보낸 PNG 의 글자 잉크 세로 위치를 비교한다. 수정 전·후에 같은 견적으로 돌려 숫자를 비교한다.
//
// 실행: PW_CHROME=<chrome-headless-shell.exe> node --env-file=<env 파일> tools/measure-png-export.mjs <출력 폴더> <라벨>
// 출력: <폴더>/<라벨>.png, <폴더>/<라벨>.json (줄별 dy 와 요약)
//
// 지표(줄마다): dy = 잉크 세로 중심 - 줄 상자 세로 중심. 단위는 레이아웃 px(화면 CSS px, 미리보기 축척 보정) 이다.
//  - dy 에는 글꼴마다 정해진 상수 편향(글리프 상자 중심과 잉크 중심의 차)과 배경 경계가 섞인다.
//    그래서 같은 요소를 브라우저가 직접 그린 화면(dsf 2 스크린샷, 대조군)에 같은 측정을 하고,
//    밀림 = PNG 의 dy - 대조군의 dy 로 정한다.
//  - 줄 위·아래 창 안에 다른 글자 줄이 걸치는 줄은 제외한다(이웃 줄 잉크가 섞여 세로 범위가 거짓이 된다).
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, openAndFill, downloadTo } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/pdfq');
const LABEL = process.argv[3] ?? 'png-export';
mkdirSync(OUT, { recursive: true });
const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3011));

try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { page } = await openAndFill(browser, vite.base, { dsf: 2 });

    // 1) PNG 내보내기 (앱의 exportToImage 를 그대로 호출: 미리보기는 축소(scale) 상태 그대로다)
    const pngPath = join(OUT, `${LABEL}.png`);
    const dl = await downloadTo(page, () => page.evaluate(async () => {
      const m = await import('/src/utils/exportPdf.ts');
      await m.exportToImage('preview-panel', 'png-export');
    }), pngPath);

    // 2) 기준: 미리보기 축소를 1 로 되돌리고(뷰포트도 키워 요소 전체가 보이게) 같은 요소의
    //    글자 줄 상자(DOM)와 브라우저가 직접 그린 화면(대조군, dsf 2)을 얻는다.
    await page.setViewportSize({ width: 1440, height: 1750 });
    await page.addStyleTag({ content: '[data-sonner-toaster]{display:none !important}' });
    await page.evaluate(() => {
      const el = document.getElementById('preview-panel');
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (a.style.transform && a.style.transform.includes('scale')) a.style.transform = 'scale(1)';
        // 조상의 잘림(overflow)과 좁은 폭 때문에 대조 화면이 오른쪽에서 잘리지 않게 한다
        a.style.overflow = 'visible';
        if (a.offsetWidth < el.offsetWidth) { a.style.width = el.offsetWidth + 'px'; a.style.minWidth = el.offsetWidth + 'px'; }
        if (a.offsetHeight < el.offsetHeight) { a.style.height = el.offsetHeight + 'px'; }
      }
      void el.offsetHeight;
    });
    await page.waitForTimeout(500);
    const dom = await page.evaluate(() => {
      const el = document.getElementById('preview-panel');
      const er = el.getBoundingClientRect();
      const scale = er.width / el.offsetWidth;
      const rects = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent.replace(/\s+/g, ' ').trim();
        if (!text) continue;
        const p = n.parentElement;
        const cs = getComputedStyle(p);
        if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.width < 8 || r.height < 6) continue;
          rects.push({
            text: text.slice(0, 14),
            fontPx: parseFloat(cs.fontSize),
            x0: (r.left - er.left) / scale, y0: (r.top - er.top) / scale, x1: (r.right - er.left) / scale, y1: (r.bottom - er.top) / scale, // 레이아웃 px
          });
        }
      }
      return { scale, width: er.width, height: er.height, offsetWidth: el.offsetWidth, rects };
    });
    const ctrlPath = join(OUT, `${LABEL}-control.png`);
    await page.locator('#preview-panel').first().screenshot({ path: ctrlPath });

    // 3) PNG 잉크 위치 측정 (브라우저 캔버스로 픽셀을 읽는다)
    const probe = await browser.newPage();
    const analyze = (file) => probe.evaluate(async ({ b64, dom }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const k = img.width / dom.offsetWidth; // 레이아웃 px → 이 이미지의 픽셀 (이미지마다 축척이 다르다)
      const layoutPerPng = 1 / k; // 이미지 픽셀 → 레이아웃 px
      const R = dom.rects;
      const lines = [];
      for (const r of R) {
        const h = r.y1 - r.y0;
        const wy0 = r.y0 - 0.25 * h, wy1 = r.y1 + 0.75 * h;
        const crowded = R.some(o => o !== r && o.x0 < r.x1 && o.x1 > r.x0 && o.y0 < wy1 && o.y1 > wy0);
        if (crowded) continue;
        const X0 = Math.max(0, Math.round(r.x0 * k)), X1 = Math.min(img.width, Math.round(r.x1 * k));
        const Y0 = Math.max(0, Math.round(wy0 * k)), Y1 = Math.min(img.height, Math.round(wy1 * k));
        if (X1 - X0 < 6 || Y1 - Y0 < 6) continue;
        const at = (x, y) => { const i = (y * img.width + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
        // 배경: 창 안 전체 픽셀의 채널별 중앙값
        const samples = [[], [], []];
        for (let y = Y0; y < Y1; y += 2) for (let x = X0; x < X1; x += 2) { const c = at(x, y); for (let q = 0; q < 3; q++) samples[q].push(c[q]); }
        const bg = samples.map(s => s.sort((a, b) => a - b)[s.length >> 1]);
        const rowInk = [];
        for (let y = Y0; y < Y1; y++) {
          let n = 0;
          for (let x = X0; x < X1; x++) { const c = at(x, y); if (Math.max(Math.abs(c[0] - bg[0]), Math.abs(c[1] - bg[1]), Math.abs(c[2] - bg[2])) > 70) n++; }
          rowInk.push(n / (X1 - X0));
        }
        const rows = [];
        rowInk.forEach((f, i) => { if (f > 0 && f < 0.9) rows.push(i); });
        if (rows.length < 2) continue;
        const inkCy = Y0 + (rows[0] + rows[rows.length - 1] + 1) / 2;
        const boxCy = ((r.y0 + r.y1) / 2) * k;
        lines.push({ text: r.text, fontPx: r.fontPx, dyLayoutPx: (inkCy - boxCy) * layoutPerPng, dyPngPx: inkCy - boxCy });
      }
      return { png: { w: img.width, h: img.height }, lines };
    }, { b64: readFileSync(file).toString('base64'), dom });
    const result = await analyze(pngPath);
    const ctrl = await analyze(ctrlPath);
    await probe.close();
    // 줄 상자는 같은 순서로 걸러지므로 key(글자+글자크기+순번) 로 짝을 짓는다
    const keyed = (ls) => { const seen = {}; return new Map(ls.map(l => { const key = `${l.text}|${l.fontPx}`; seen[key] = (seen[key] ?? 0) + 1; return [`${key}|${seen[key]}`, l]; })); };
    const cm = keyed(ctrl.lines);
    const pairs = [];
    for (const [key, l] of keyed(result.lines)) {
      const c = cm.get(key);
      if (c) pairs.push({ text: l.text, fontPx: l.fontPx, pngDy: l.dyLayoutPx, ctrlDy: c.dyLayoutPx, shift: l.dyLayoutPx - c.dyLayoutPx });
    }

    const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
    const dys = pairs.map(l => l.shift);
    const summary = {
      label: LABEL,
      downloadMs: dl.ms,
      png: result.png,
      control: ctrl.png,
      domPanel: { offsetWidth: dom.offsetWidth, rectWidth: +dom.width.toFixed(1), previewScale: +dom.scale.toFixed(4) },
      totalTextRects: dom.rects.length,
      measuredLines: dys.length,
      shiftLayoutPx: {
        median: +med(dys).toFixed(2),
        mean: +(dys.reduce((a, b) => a + b, 0) / dys.length).toFixed(2),
        min: +Math.min(...dys).toFixed(2),
        max: +Math.max(...dys).toFixed(2),
        meanAbs: +(dys.reduce((a, b) => a + Math.abs(b), 0) / dys.length).toFixed(2),
      },
      shiftOverFontSizeMedian: +med(pairs.map(l => l.shift / l.fontPx)).toFixed(3),
      linesShiftedOver1px: dys.filter(v => Math.abs(v) > 1).length,
    };
    writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify({ summary, pairs }, null, 2));
    console.log(JSON.stringify(summary, null, 2));
    for (const l of pairs.slice(0, 14)) console.log(`  ${l.text.padEnd(16)} font ${String(l.fontPx).padEnd(5)} png ${l.pngDy.toFixed(2)} ctrl ${l.ctrlDy.toFixed(2)} shift ${l.shift.toFixed(2)}px`);
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}
