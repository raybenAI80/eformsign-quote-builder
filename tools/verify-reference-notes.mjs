// 참고사항 요금제(충전형·구독형) 안내 브라우저 시나리오 검증.
// 첫 화면 문구 → 구독형 품목 경고 → 구독형 문구로 바꾸기·견적일별 600/800원 → 저장 직전 확인창
// → 혼합 안내 → 새로고침 뒤 문구 불변 → 요금제별 기본값 저장·불러오기. 기대와 다르면 exit 1.
// 실행: PW_CHROME=<chrome-headless-shell.exe> node --env-file=<env 파일> tools/verify-reference-notes.mjs <출력 폴더>
//   (QB_BASE_URL 이 있으면 vite 를 새로 띄우지 않는다.) 스크린샷은 <출력 폴더>/impl-*.png, 다운로드는 같은 폴더.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, fillBasic, fillSales } from './lib/quote-driver.mjs';

const OUT = resolve(process.argv[2] ?? '.work/verify-reference-notes');
mkdirSync(OUT, { recursive: true });
const { chromium } = loadPlaywright();
const results = { steps: {}, failures: [] };
const fail = (key, msg) => results.failures.push(`${key}: ${msg}`);
const expect = (key, cond, msg) => { if (!cond) fail(key, msg); };

// 기대 문구 (src/constants.ts 의 두 세트와 같아야 한다. 구현 파일을 import 하지 않고 따로 적어 서로 대조한다)
const L1 = '본 견적은 『{고객사명}의 전자계약 서비스 eformsign 도입』에 한하여 적용되는 견적입니다.';
const P5 = '클라우드 서비스 업데이트로 추가된 신규 기능은 무상으로 제공합니다. (일부 기능은 유상이며, 반영 전에 공지합니다.)';
const P6 = '본 계약은 상호 신뢰를 바탕으로 체결하며, 분쟁이 있을 경우 상관례에 따라 상호 협의하여 해결합니다.';
const P7 = 'Trial 기간 동안 API 연동 기술지원을 요청하시면 유선 및 원격으로 지원합니다.';
const P8 = '기타 사항은 www.eformsign.com 이용약관에 따릅니다.';
const PREPAID = [
  L1,
  '계약기간: 계약 시작일로부터 1년입니다.',
  '문서 사용기한: 계약 시작일로부터 최대 2년까지 사용할 수 있습니다.',
  '문서 소진 시, 본 견적에 포함된 사항 외에 별도로 사용된 유료 옵션은 실제 사용량에 따라 일괄 청구됩니다.',
  P5, P6, P7, P8,
];
const SUBSCRIPTION = [
  L1,
  '청구일: 익월 1일에 청구하고, 7일에 등록된 카드로 결제합니다.',
  '구독형 Business 요금제는 매월 기본 문서 100건을 제공하며, 남은 문서는 이월되지 않습니다.',
  '초과 이용 문서에 대한 금액(1건당 600원)은 추후 인상될 수 있습니다.',
  '본 견적에 포함된 사항 외에 별도로 사용된 유료 옵션은 실제 사용량에 따라 일괄 청구됩니다.',
  P5, P6, P7, P8,
];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const vite = await startVite(Number(process.env.QB_PORT ?? 3022));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROME, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(() => {
    try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ }
  });
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const dialogs = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });

  const open = async () => {
    await page.goto(`${vite.base}/?bypass-auth`);
    await page.waitForTimeout(2000);
    const skip = page.getByText('건너뛰기');
    if (await skip.count()) await skip.first().click();
    await page.waitForTimeout(300);
  };
  const tab = async re => { await page.getByRole('button', { name: re }).first().click(); await page.waitForTimeout(450); };
  const card = () => page.locator('#reference-notes-card');
  const editorNotes = () => card().locator('textarea').evaluateAll(els => els.map(t => t.value));
  const previewNotes = () => page.evaluate(() =>
    [...document.querySelectorAll('#preview-panel .qd-notes p')].map(p => p.innerText.replace(/\s+/g, ' ').trim()));
  const setQuoteDate = value => page.locator('input[type="date"]').first().evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const shot = async (name, locator) => {
    const path = join(OUT, `impl-${name}.png`);
    if (locator) { await locator.scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await locator.screenshot({ path }); }
    else await page.screenshot({ path });
  };
  const badge = () => page.getByTestId('plan-type-badge');
  const warning = () => page.getByTestId('notes-mismatch-warning');
  const modal = () => page.getByTestId('notes-mismatch-modal');
  const addItem = async name => { await tab(/항목/); await page.getByRole('button', { name }).click(); await page.waitForTimeout(300); };
  const pdfBtn = () => page.locator('button[title="PDF / 인쇄"]');
  const pngBtn = () => page.locator('button[title="PNG 이미지로 저장"]');
  const download = async (trigger, name) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), trigger()]);
    const path = join(OUT, name);
    await dl.saveAs(path);
    return dl.suggestedFilename();
  };

  // 저장 검증(ensureValid)을 통과하도록 견적 정보를 채운다
  await open();
  await tab(/기본 정보/);

  // a) 첫 화면
  const a = {};
  a.editor = await editorNotes();
  a.badge = await badge().count();
  a.warning = await warning().count();
  expect('a', same(a.editor, PREPAID), `첫 화면 참고사항이 충전형 8문장이 아님: ${JSON.stringify(a.editor)}`);
  expect('a', a.badge === 0 && a.warning === 0, '품목이 없는데 배지·경고가 보임');
  await shot('a-fresh-notes', card());
  results.steps.a = a;

  await fillBasic(page);
  await fillSales(page);

  // b) 구독형 Business 추가 → 배지·경고·행 표시
  await addItem('+ 구독형 Business');
  await tab(/기본 정보/);
  const b = {};
  b.badge = (await badge().innerText()).trim();
  b.warning = (await warning().innerText()).replace(/\s+/g, ' ');
  b.flagged = await card().locator('[data-note-flagged="true"]').count();
  b.flagText = await page.getByTestId('note-flag-1').innerText();
  expect('b', b.badge === '품목 기준 요금제: 구독형 Business', `배지 문구: ${b.badge}`);
  expect('b', b.warning.includes('참고사항이 요금제와 맞지 않습니다') && b.warning.includes('구독형 품목이 있는데 충전형 문장이 남아 있습니다'), `경고 문구: ${b.warning}`);
  expect('b', ['2번 계약기간', '3번 문서 사용기한', '4번 문서 소진 시'].every(t => b.warning.includes(t)), `경고 목록에 2·3·4번이 없음: ${b.warning}`);
  expect('b', b.flagged === 3, `표시된 행 ${b.flagged}개 (3 기대)`);
  expect('b', b.flagText.includes('충전형 문구입니다'), `행 표시 문구: ${b.flagText}`);
  await shot('b-subscription-warning', card());
  results.steps.b = b;

  // 「이대로 둠」 → 경고 숨김, 행 표시는 유지, 문구 바꾸면 다시 보임(아래 d 에서 확인)
  await page.getByRole('button', { name: '이대로 둠' }).click();
  await page.waitForTimeout(200);
  expect('b', (await warning().count()) === 0, '「이대로 둠」 뒤에도 경고가 보임');
  expect('b', (await editorNotes()).length === 8, '「이대로 둠」이 문구를 바꿈');

  // 문구를 한 글자 고치면 경고가 다시 보인다(이대로 둠은 그 문구·품목 상태에서만 유효)
  await card().locator('textarea').first().fill(L1 + ' ');
  await page.waitForTimeout(300);
  expect('b', (await warning().count()) === 1, '문구를 고쳤는데 경고가 다시 보이지 않음');

  // c) 경고 상자의 「구독형 문구로 바꾸기」 — 사용자가 고친 문구가 있으므로 확인창이 뜬다
  await page.getByRole('button', { name: '구독형 문구로 바꾸기' }).click();
  await page.waitForTimeout(400);
  const c = {};
  c.confirm = dialogs.at(-1);
  c.editor = await editorNotes();
  c.warningCount = await warning().count();
  expect('c', /8줄/.test(c.confirm ?? '') && /구독형 문구/.test(c.confirm ?? ''), `확인창 문구: ${c.confirm}`);
  expect('c', same(c.editor, SUBSCRIPTION), `구독형 9문장이 아님: ${JSON.stringify(c.editor)}`);
  expect('c', c.warningCount === 0, '구독형 문구로 바꾼 뒤에도 경고가 보임');
  await shot('c-subscription-notes', card());
  await tab(/기본 정보/);
  await setQuoteDate('2026-10-30');
  await page.waitForTimeout(400);
  c.preview1030 = (await previewNotes())[3];
  await setQuoteDate('2027-01-02');
  await page.waitForTimeout(400);
  c.preview0102 = (await previewNotes())[3];
  c.spanChildren = await page.evaluate(() => document.querySelectorAll('#preview-panel .qd-notes p span *').length);
  c.stored = await page.evaluate(() => JSON.parse(localStorage.getItem('eformsign_quote_simple_contacts_v2_ascii')).meta.referenceNotes[3]);
  expect('c', c.preview1030?.includes('1건당 600원'), `견적일 2026-10-30 미리보기 4번: ${c.preview1030}`);
  expect('c', c.preview0102?.includes('1건당 800원') && !c.preview0102.includes('600원'), `견적일 2027-01-02 미리보기 4번: ${c.preview0102}`);
  expect('c', c.spanChildren === 0, `참고사항 문장 안에 인라인 태그 ${c.spanChildren}개`);
  expect('c', c.stored.includes('600원'), '저장된 문구가 바뀜(렌더 때만 바뀌어야 함)');
  await shot('c-preview-notes-20270102', page.locator('#preview-panel .qd-notes').first());
  await setQuoteDate('2026-10-30');
  results.steps.c = c;

  // d) 충전형 문구로 되돌림 → 경고 → 저장 직전 확인창
  await page.getByRole('button', { name: '충전형 문구 불러오기' }).click();
  await page.waitForTimeout(400);
  const d = {};
  d.warningBack = await warning().count();
  expect('d', d.warningBack === 1, '충전형 문구로 되돌린 뒤 경고가 다시 보여야 함(문구가 바뀌어 「이대로 둠」 해제)');
  await shot('d-prepaid-warning-again', card());
  await pdfBtn().click();
  await page.waitForTimeout(500);
  d.modalText = (await modal().innerText()).replace(/\s+/g, ' ');
  expect('d', d.modalText.includes('참고사항을 확인해 주세요'), `확인창 제목 없음: ${d.modalText}`);
  expect('d', d.modalText.includes('이 견적은 구독형 품목으로 되어 있는데, 참고사항에 충전형 문장 3개가 남아 있습니다.'), `확인창 본문: ${d.modalText}`);
  expect('d', d.modalText.includes('2번 계약기간') && d.modalText.includes('3번 문서 사용기한') && d.modalText.includes('4번 문서 소진 시'), '확인창 목록');
  await page.screenshot({ path: join(OUT, 'impl-d-modal.png') });
  d.pdfFile = await download(() => page.getByRole('button', { name: '그대로 저장' }).click(), 'impl-d-saved.pdf');
  expect('d', /\.pdf$/.test(d.pdfFile), `PDF 가 내려받아지지 않음: ${d.pdfFile}`);
  d.modalClosedAfterSave = (await modal().count()) === 0;
  expect('d', d.modalClosedAfterSave, '그대로 저장 뒤 확인창이 남아 있음');

  // PNG 도 같은 확인창
  await pngBtn().click();
  await page.waitForTimeout(500);
  expect('d', (await modal().count()) === 1, 'PNG 저장에서 확인창이 안 뜸');
  d.pngFile = await download(() => page.getByRole('button', { name: '그대로 저장' }).click(), 'impl-d-saved.png');
  expect('d', /\.png$/.test(d.pngFile), `PNG 가 내려받아지지 않음: ${d.pngFile}`);

  // 참고사항 고치기: 다른 탭에서 눌러도 기본 정보 탭의 참고사항 카드로 이동
  await tab(/항목/);
  await pdfBtn().click();
  await page.waitForTimeout(500);
  expect('d', (await modal().count()) === 1, '항목 탭에서 PDF 저장 시 확인창이 안 뜸');
  await page.getByRole('button', { name: '참고사항 고치기' }).click();
  await page.waitForTimeout(1200);
  d.fix = await page.evaluate(() => {
    const el = document.getElementById('reference-notes-card');
    if (!el) return { exists: false };
    const r = el.getBoundingClientRect();
    return { exists: true, top: Math.round(r.top), inView: r.top < innerHeight && r.bottom > 0, focused: document.activeElement === el };
  });
  expect('d', (await modal().count()) === 0, '참고사항 고치기 뒤 확인창이 닫히지 않음');
  expect('d', d.fix.exists && d.fix.inView, `참고사항 카드로 이동하지 못함: ${JSON.stringify(d.fix)}`);
  expect('d', d.fix.focused, '참고사항 카드에 포커스가 없음');
  await page.screenshot({ path: join(OUT, 'impl-d-after-fix.png') });
  results.steps.d = d;

  // e) 충전형 품목도 추가 → 혼합: 파란 안내, 경고 없음, 저장 확인창 없음
  await addItem('+ 충전형 문서');
  await tab(/기본 정보/);
  const e = {};
  e.badge = (await badge().innerText()).trim();
  e.mixedInfo = (await page.getByTestId('notes-mixed-info').innerText()).replace(/\s+/g, ' ');
  e.warning = await warning().count();
  expect('e', e.badge === '품목 기준 요금제: 충전형 + 구독형 Business', `혼합 배지: ${e.badge}`);
  expect('e', e.mixedInfo.includes('충전형과 구독형 품목이 함께 있습니다. 자동 판단을 하지 않으니 참고사항을 직접 확인해 주세요.'), `혼합 안내: ${e.mixedInfo}`);
  expect('e', e.warning === 0, '혼합인데 경고가 보임');
  await shot('e-mixed-info', card());
  const [mixedDl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), pdfBtn().click()]);
  e.modalOnMixed = await modal().count();
  e.mixedFile = mixedDl.suggestedFilename();
  expect('e', e.modalOnMixed === 0, '혼합인데 저장 확인창이 뜸');
  expect('e', /\.pdf$/.test(e.mixedFile), '혼합 상태에서 PDF 가 곧바로 내려받아지지 않음');
  results.steps.e = e;

  // f) 새로고침 → 저장 상태 복원, 문구 자동 변경 없음. 충전형 품목만 지운 저장본으로도 경고가 상태를 따라간다
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const k = 'eformsign_quote_simple_contacts_v2_ascii';
    const d = JSON.parse(localStorage.getItem(k));
    d.items = d.items.filter(i => i.category !== '문서 충전');
    localStorage.setItem(k, JSON.stringify(d));
  });
  const before = await editorNotes();
  await page.evaluate(() => { window.addEventListener('beforeunload', e => e.stopImmediatePropagation(), true); });
  await open();
  await tab(/기본 정보/);
  const f = {};
  f.editor = await editorNotes();
  f.badge = (await badge().innerText()).trim();
  f.warning = (await warning().innerText()).replace(/\s+/g, ' ');
  expect('f', same(f.editor, before), '새로고침 뒤 참고사항이 바뀜');
  expect('f', same(f.editor, PREPAID), '복원된 참고사항이 충전형 문구가 아님');
  expect('f', f.badge === '품목 기준 요금제: 구독형 Business', `복원 뒤 배지: ${f.badge}`);
  expect('f', f.warning.includes('2번') && f.warning.includes('4번'), `복원 뒤 경고: ${f.warning}`);
  await shot('f-after-reload', card());
  // 고치지 않은 충전형 문구 그대로이면 경고 상자의 「구독형 문구로 바꾸기」는 확인창 없이 바꾼다
  const dialogsBefore = dialogs.length;
  await page.getByRole('button', { name: '구독형 문구로 바꾸기' }).click();
  await page.waitForTimeout(400);
  f.replacedNoConfirm = dialogs.length === dialogsBefore;
  f.afterReplace = await editorNotes();
  expect('f', f.replacedNoConfirm, '고치지 않은 문구인데 확인창이 뜸');
  expect('f', same(f.afterReplace, SUBSCRIPTION), '경고 상자 버튼이 구독형 9문장으로 바꾸지 못함');
  results.steps.f = f;

  // g) 구독형 기본값 저장 → 새로고침 → 불러오기
  const first = card().locator('textarea').first();
  await first.fill(L1 + ' (커스텀)');
  await page.getByRole('button', { name: '기본값으로 저장' }).click();
  await page.waitForTimeout(250);
  const g = {};
  g.choice = (await page.getByTestId('save-default-choice').innerText()).replace(/\s+/g, ' ');
  expect('g', g.choice.includes('충전형 기본값으로 저장') && g.choice.includes('구독형 기본값으로 저장'), `저장 선택: ${g.choice}`);
  g.highlight = await page.getByTestId('save-default-choice').getByRole('menuitem', { name: /구독형 기본값으로 저장/ }).innerText();
  expect('g', g.highlight.includes('품목 기준'), '품목 기준 요금제 항목이 표시되지 않음');
  await shot('g-save-choice', card());
  await page.getByRole('menuitem', { name: /구독형 기본값으로 저장/ }).click();
  await page.waitForTimeout(300);
  g.keys = await page.evaluate(() => ({
    sub: localStorage.getItem('eformsign_custom_reference_notes_subscription') !== null,
    pre: localStorage.getItem('eformsign_custom_reference_notes_prepaid') !== null,
  }));
  expect('g', g.keys.sub && !g.keys.pre, `저장 키: ${JSON.stringify(g.keys)}`);
  await page.waitForTimeout(800);
  await open();
  await tab(/기본 정보/);
  await page.getByRole('button', { name: '충전형 문구 불러오기' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '구독형 문구 불러오기' }).click();
  await page.waitForTimeout(400);
  g.loaded = await editorNotes();
  expect('g', g.loaded.length === 9 && g.loaded[0].endsWith('(커스텀)'), `저장한 구독형 기본값이 불러와지지 않음: ${JSON.stringify(g.loaded)}`);
  // 옛 키는 충전형 기본값으로 읽는다
  await page.evaluate(() => localStorage.setItem('eformsign_custom_reference_notes', JSON.stringify(['옛 키 문구'])));
  await page.getByRole('button', { name: '충전형 문구 불러오기' }).click();
  await page.waitForTimeout(400);
  g.legacy = await editorNotes();
  expect('g', same(g.legacy, ['옛 키 문구']), `옛 키가 충전형 기본값으로 읽히지 않음: ${JSON.stringify(g.legacy)}`);
  // 깨진 값은 오류 없이 내장 문구로
  await page.evaluate(() => { localStorage.removeItem('eformsign_custom_reference_notes'); localStorage.setItem('eformsign_custom_reference_notes_prepaid', '{깨짐'); });
  await page.getByRole('button', { name: '구독형 문구 불러오기' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '충전형 문구 불러오기' }).click();
  await page.waitForTimeout(400);
  g.broken = await editorNotes();
  expect('g', same(g.broken, PREPAID), `깨진 값일 때 내장 충전형 문구가 아님: ${JSON.stringify(g.broken)}`);
  await shot('g-loaded', card());
  results.steps.g = g;

  // h) 구독형 Personal 만 있는 새 견적: 구독형 문구가 Personal 수치(50건·1,000원)로 보인다. Business 를 더하면 Business 수치로 돌아간다
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page2 = await ctx2.newPage();
  page2.on('pageerror', e => pageErrors.push(String(e)));
  page2.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  await page2.goto(`${vite.base}/?bypass-auth`);
  await page2.waitForTimeout(2000);
  const skip2 = page2.getByText('건너뛰기');
  if (await skip2.count()) await skip2.first().click();
  await page2.waitForTimeout(300);
  const tab2 = async re => { await page2.getByRole('button', { name: re }).first().click(); await page2.waitForTimeout(450); };
  const prev2 = () => page2.evaluate(() => [...document.querySelectorAll('#preview-panel .qd-notes p')].map(p => p.innerText.replace(/\s+/g, ' ').trim()));
  const date2 = value => page2.locator('input[type="date"]').first().evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const h = {};
  await tab2(/항목/);
  await page2.getByRole('button', { name: '+ 구독형 Personal' }).click();
  await page2.waitForTimeout(300);
  await tab2(/기본 정보/);
  h.badge = (await page2.getByTestId('plan-type-badge').innerText()).trim();
  expect('h', h.badge === '품목 기준 요금제: 구독형 Personal', `Personal 배지: ${h.badge}`);
  const dlg0 = dialogs.length;
  await page2.getByRole('button', { name: '구독형 문구로 바꾸기' }).click();
  await page2.waitForTimeout(400);
  expect('h', dialogs.length === dlg0, '고치지 않은 충전형 문구인데 확인창이 뜸');
  await date2('2026-10-30');
  await page2.waitForTimeout(300);
  h.preview1030 = await prev2();
  await date2('2027-01-02');
  await page2.waitForTimeout(300);
  h.preview0102 = await prev2();
  for (const [k, v] of [['2026-10-30', h.preview1030], ['2027-01-02', h.preview0102]]) {
    expect('h', v[2]?.includes('구독형 Personal 요금제는 매월 기본 문서 50건을 제공'), `${k} 3번 문장: ${v[2]}`);
    expect('h', v[3]?.includes('1건당 1,000원') && !v[3].includes('800원') && !v[3].includes('600원'), `${k} 4번 문장: ${v[3]}`);
  }
  h.stored = await page2.evaluate(() => JSON.parse(localStorage.getItem('eformsign_quote_simple_contacts_v2_ascii')).meta.referenceNotes.slice(2, 4));
  expect('h', h.stored[0].includes('Business') && h.stored[1].includes('600원'), '저장 문구가 바뀜');
  await page2.locator('#preview-panel .qd-notes').first().scrollIntoViewIfNeeded();
  await page2.locator('#preview-panel .qd-notes').first().screenshot({ path: join(OUT, 'impl-h-personal.png') });
  await page2.locator('#reference-notes-card').screenshot({ path: join(OUT, 'impl-h-personal-editor.png') });
  await tab2(/항목/);
  await page2.getByRole('button', { name: '+ 구독형 Business' }).click();
  await page2.waitForTimeout(300);
  await tab2(/기본 정보/);
  h.badgeBoth = (await page2.getByTestId('plan-type-badge').innerText()).trim();
  h.previewBoth = await prev2();
  h.conflictCount = await page2.getByTestId('notes-tier-conflict').count();
  expect('h', h.badgeBoth === '품목 기준 요금제: 구독형 Business + Personal', `둘 다 있을 때 배지: ${h.badgeBoth}`);
  expect('h', h.conflictCount === 0, '둘 다 있어도 입력 실수 경고는 없어야 함');
  expect('h', h.previewBoth[2]?.includes('구독형 Business 요금제는 매월 기본 문서 100건, 구독형 Personal 요금제는 매월 기본 문서 50건을 제공'), `둘 다 있을 때 3번 문장: ${h.previewBoth[2]}`);
  expect('h', h.previewBoth[3]?.includes('(Business 1건당 800원, Personal 1건당 1,000원)'), `둘 다 있을 때 4번 문장(견적일 2027-01-02): ${h.previewBoth[3]}`);
  await date2('2026-10-30');
  await page2.waitForTimeout(300);
  h.previewBoth1030 = await prev2();
  expect('h', h.previewBoth1030[3]?.includes('(Business 1건당 600원, Personal 1건당 1,000원)'), `둘 다 있을 때 4번 문장(견적일 2026-10-30): ${h.previewBoth1030[3]}`);
  await page2.locator('#preview-panel .qd-notes').first().scrollIntoViewIfNeeded();
  await page2.locator('#preview-panel .qd-notes').first().screenshot({ path: join(OUT, 'impl-h-both.png') });
  await page2.locator('#reference-notes-card').screenshot({ path: join(OUT, 'impl-h-both-editor.png') });
  results.steps.h = h;
  await ctx2.close();

  expect('console', pageErrors.length === 0, `페이지 오류: ${pageErrors.join(' | ')}`);
  results.pageErrors = pageErrors;
  results.consoleErrors = consoleErrors;
  results.dialogs = dialogs;
  await ctx.close();
} finally {
  await browser.close();
  vite.stop();
}
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
if (results.failures.length) {
  console.error('\nFAIL:\n- ' + results.failures.join('\n- '));
  process.exit(1);
}
console.log('\nPASS: 참고사항 요금제 안내 시나리오 전부 통과');
