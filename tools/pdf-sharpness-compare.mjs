// PDF 선명도 비교 자료 생성: 같은 견적(품목 3개, 일반 견적서)으로 래스터 방식이 다른 PDF 4종을 만들고
// 크기·생성 시간을 재고, 1쪽의 세 곳을 600dpi 원본 픽셀로 잘라 비교 시트(sharpness-sheet.png)를 만든다.
// 앱 코드의 기본값은 바꾸지 않는다: playwright 라우트로 dev 서버가 내려주는 exportPdf 모듈 소스에서
// html2canvas scale·toDataURL 형식·품질·addImage 형식만 실행 중에 치환한다(window.__Q).
//
// 실행: PW_CHROME=<chrome-headless-shell.exe> [PYI=<python 실행 파일>] node --env-file=<env 파일> tools/pdf-sharpness-compare.mjs <출력 폴더>
// 출력: 방식별 PDF(<id>.pdf), crop-spec.json(측정·위치), 시트·크롭 PNG(tools/make-sharpness-sheet.py 가 만든다)
// 생성 시간 = PDF 버튼 클릭부터 다운로드 이벤트까지(ms). 첫 실행(폰트 로드)은 버리고 3회 돌려 중앙값을 쓴다.
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, startVite, openAndFill, fillBasic, fillSales, addItems } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/pdfq');
mkdirSync(OUT, { recursive: true });
const HERE = dirname(fileURLToPath(import.meta.url));

const VARIANTS = [
  { id: 'v1-s2-jpeg95', label: '현재: scale 2 · JPEG 0.95', q: { scale: 2, mime: 'image/jpeg', quality: 0.95, fmt: 'JPEG' } },
  { id: 'v2-s2-png', label: 'scale 2 · PNG(무손실)', q: { scale: 2, mime: 'image/png', quality: 1, fmt: 'PNG' } },
  { id: 'v3-s3-jpeg95', label: 'scale 3 · JPEG 0.95', q: { scale: 3, mime: 'image/jpeg', quality: 0.95, fmt: 'JPEG' } },
  { id: 'v4-s3-jpeg90', label: 'scale 3 · JPEG 0.9', q: { scale: 3, mime: 'image/jpeg', quality: 0.9, fmt: 'JPEG' } },
];
const ROUNDS = 3;

const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3011));
try {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME });
  try {
    const { ctx, page } = await openAndFill(browser, vite.base);

    // exportPdf 모듈 소스를 치환해 내려준다 (저장소 소스는 그대로)
    let patched = 0;
    await ctx.route(/\/src\/utils\/exportPdf\.ts(\?.*)?$/, async route => {
      const res = await route.fetch();
      let body = await res.text();
      const n0 = body.length;
      body = body.replace(/scale: 2,/g, () => { patched++; return 'scale: (window.__Q?.scale ?? 2),'; });
      body = body.replace(/toDataURL\((["'])image\/jpeg\1, 0\.95\)/g, () => { patched++; return 'toDataURL((window.__Q?.mime ?? "image/jpeg"), (window.__Q?.quality ?? 0.95))'; });
      body = body.replace(/addImage\((\w+), (["'])JPEG\2,/g, (_m, v) => { patched++; return `addImage(${v}, (window.__Q?.fmt ?? "JPEG"),`; });
      const headers = { ...res.headers() };
      delete headers['content-length']; delete headers.etag; delete headers['cache-control'];
      await route.fulfill({ status: 200, headers: { ...headers, 'cache-control': 'no-store' }, body });
      if (body.length === n0) console.warn('경고: exportPdf 소스에 치환할 곳이 없었다');
    });
    await page.reload();
    await page.waitForTimeout(2500);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    // 새로고침으로 입력이 비워지므로 다시 채운다
    await fillBasic(page); await fillSales(page); await addItems(page);
    await page.getByRole('button', { name: /기본 정보/ }).first().click();
    await page.waitForTimeout(600);
    // 모듈은 PDF 버튼을 처음 쓸 때가 아니라 앱 로드 때 평가되므로, 여기서 치환 여부를 확인한다
    const probe = await page.evaluate(async () => (await import('/src/utils/exportPdf.ts')).exportToPdf.toString());
    const ok = /window\.__Q/.test(probe);
    console.log('치환된 위치:', patched, '/ 함수 본문에 치환 반영:', ok);
    if (patched < 4 || !ok) throw new Error(`exportPdf 치환 실패: ${patched}곳, 반영 ${ok}`);

    const runOnce = async v => {
      await page.evaluate(q => { window.__Q = q; }, v.q);
      const t0 = Date.now();
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 180000 }),
        page.locator('button[title="PDF / 인쇄"]').click(),
      ]);
      const ms = Date.now() - t0;
      const path = join(OUT, `${v.id}.pdf`);
      await dl.saveAs(path);
      return { ms, bytes: statSync(path).size };
    };

    await runOnce(VARIANTS[0]); // 폰트 로드 등 첫 실행 비용은 버린다
    const times = Object.fromEntries(VARIANTS.map(v => [v.id, []]));
    const bytes = {};
    for (let r = 0; r < ROUNDS; r++) {
      for (const v of VARIANTS) {
        const { ms, bytes: b } = await runOnce(v);
        times[v.id].push(ms); bytes[v.id] = b;
        console.log(`round ${r + 1} ${v.id}: ${ms}ms ${(b / 1048576).toFixed(2)}MB`);
        await page.waitForTimeout(500);
      }
    }
    await page.evaluate(() => { delete window.__Q; });

    // 크롭 위치: 숨겨진 PDF 캡처 패널 안의 세 요소를 PDF 1쪽의 mm 좌표로 환산한다
    const regions = await page.evaluate(() => {
      const panel = document.getElementById('pdf-preview-panel');
      const pr = panel.getBoundingClientRect();
      const sc = pr.width / panel.offsetWidth;
      const W = panel.offsetWidth, H = panel.offsetHeight;
      // computePageImageLayout 와 같은 계산 (A4 210x297, 여백 2mm)
      const aw = 206, ah = 293;
      const aspect = W / H;
      let imgW, offX;
      if (aspect > aw / ah) { imgW = aw; offX = 2; } else { imgW = ah * aspect; offX = 2 + (aw - imgW) / 2; }
      const mmPerPx = imgW / W;
      const box = (el, padX, padY, maxWcss) => {
        const r = el.getBoundingClientRect();
        const x = (r.left - pr.left) / sc, y = (r.top - pr.top) / sc, w = r.width / sc, h = r.height / sc;
        const cw = Math.min(w + padX * 2, maxWcss);
        return { x_mm: offX + (x - padX) * mmPerPx, y_mm: 2 + (y - padY) * mmPerPx, w_mm: cw * mmPerPx, h_mm: (h + padY * 2) * mmPerPx };
      };
      const note = [...panel.querySelectorAll('.qd-items td.qd-item .qd-note')].find(n => n.textContent.trim());
      const band = panel.querySelector('.qd-three h3');
      const st = panel.querySelector('.qd-gen-str .qd-st');
      return {
        note: note ? { text: note.textContent.trim().slice(0, 30), ...box(note, 6, 5, 240) } : null,
        band: band ? { text: band.textContent.trim(), ...box(band, 0, 4, 190) } : null,
        strength: st ? { text: st.textContent.trim().slice(0, 30), ...box(st, 6, 6, 190) } : null,
      };
    });
    console.log('regions', JSON.stringify(regions));
    if (!regions.note || !regions.band || !regions.strength) throw new Error('크롭 위치 요소를 찾지 못했다: ' + JSON.stringify(regions));

    const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
    const spec = {
      dpi: 600,
      regions,
      variants: VARIANTS.map(v => ({
        id: v.id, label: v.label, file: `${v.id}.pdf`,
        bytes: bytes[v.id], ms_median: median(times[v.id]), ms_all: times[v.id],
      })),
    };
    writeFileSync(join(OUT, 'crop-spec.json'), JSON.stringify(spec, null, 2));
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
}

const py = process.env.PYI ?? 'python';
const r = spawnSync(py, [join(HERE, 'make-sharpness-sheet.py'), OUT], { stdio: 'inherit', shell: true });
if (r.status !== 0) {
  console.error(`시트 생성 실패(status ${r.status}). 수동 실행: ${py} tools/make-sharpness-sheet.py "${OUT}"`);
  process.exitCode = 1;
}
