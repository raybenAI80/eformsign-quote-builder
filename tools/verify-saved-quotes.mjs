// 저장된 견적서(멀티 견적) 브라우저 검증: 저장소가 깨졌을 때·가득 찼을 때·탭 두 개가 함께 쓸 때·구분 이름·병합 PDF 글자 층.
//
// 배경(2026-11-13 점검에서 재현한 결함):
//   D1 localStorage `eq_saved_quotes` 가 깨져 있으면(`{"a":1}`·`null`·`[null]`·meta/items 없는 항목) 앱 전체가 흰 화면으로 죽고 계속 그대로다.
//   D2 저장 공간이 모자라 쓰기에 실패해도 「저장되었습니다」를 띄우고 목록에는 보이지만 새로고침하면 사라진다.
//   D3 탭 두 개가 같은 목록을 서로 덮어쓴다(마운트 때 읽은 목록 위에 쓴다).
//   D4 견적서에 구분 이름(문서·크레딧 …)이 저장되지 않아 불러오기·병합 PDF 가 현재 화면의 구분 이름을 쓴다.
//   D5 21번째 저장이 가장 오래된 견적서를 말없이 지운다.
//   M1 같은 이름을 두 번 저장하면 똑같은 행이 둘 보인다(날짜만 있고 시각이 없다).
//   M2 아주 긴 이름이 행을 밀어내고 토스트가 이름을 그대로 길게 보여 준다.
//   M3 PDF 글자 층에서 텍스트 노드 사이 공백이 빠져 「사업자등록번호 108-81-85184」(공백 포함)를 검색할 수 없다.
//   S  (기능) 저장 목록 검색: 이름·고객사로 거르기, NFD 입력, 공백 무시, 특수문자, 지우기·Esc, 가려진 선택의 병합, 다시 열면 비움.
//
// 이 도구는 옛 코드(origin/main)에서 실패하고 고친 코드에서 통과해야 한다(2026-11-13 양쪽 실행으로 확인).
// 실행: PW_CHROME=<chrome-headless-shell> [QB_BASE_URL=<주소>] node --env-file=<env 파일> tools/verify-saved-quotes.mjs <출력 폴더>
//   판정: 모든 항목 PASS 면 exit 0, 하나라도 FAIL 이면 exit 1. python 에 pymupdf 가 필요하다.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywright, startVite, openAndFill, fillBasic, downloadTo, dismissOnboarding, launchBrowser, runPython, parseArgs } from './lib/quote-driver.mjs';

const { positional } = parseArgs(process.argv.slice(2));
const OUT = resolve(positional[0] ?? '.work/verify-saved-quotes');
mkdirSync(OUT, { recursive: true });

const KEY = 'eq_saved_quotes';
const LIMIT = 20;
const results = [];
const check = (scenario, name, ok, detail = '') => {
  results.push({ scenario, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${scenario}] ${name}${detail ? ' — ' + detail : ''}`);
};

const validEntry = (id, name, savedAt = '2026-11-13T05:05:00.000Z', extra = {}) => ({
  id, name, meta: { customerName: '검증고객' }, items: [], savedAt, ...extra,
});

const { chromium } = loadPlaywright();
const vite = await startVite(Number(process.env.QB_PORT ?? 3027));

/** 저장 목록을 시작 전에 심은 새 컨텍스트와 페이지. 저장 선택창은 없앤다. */
async function newPage(browser, seed) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  await ctx.addInitScript(([key, value]) => {
    try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ }
    if (value !== null && !sessionStorage.getItem('qb-seeded')) { localStorage.setItem(key, value); sessionStorage.setItem('qb-seeded', '1'); }
  }, [KEY, seed ?? null]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message ?? e)));
  return { ctx, page, errors };
}

/** 앱이 그려질 때까지 기다린다(흰 화면이면 false). */
async function appRenders(page, base) {
  await page.goto(`${base}/?bypass-auth`);
  try {
    await page.getByRole('button', { name: /기본 정보/ }).first().waitFor({ state: 'visible', timeout: 8000 });
  } catch { return false; }
  await dismissOnboarding(page);
  await page.addStyleTag({ content: '[data-sonner-toaster]{pointer-events:none}' });
  return true;
}

const openPanel = async page => {
  await page.getByRole('button', { name: /멀티 견적/ }).first().click();
  await page.getByPlaceholder(/견적서 이름/).waitFor({ state: 'visible', timeout: 5000 });
};
const closePanel = page => page.getByRole('button', { name: '닫기' }).click();
const saveButton = page => page.getByRole('button', { name: '저장', exact: true });
// sonner 토스트도 <li> 이므로 저장 목록(<ul>)의 행만 센다
const rowCount = page => page.locator('ul > li').count();
const toasts = page => page.locator('[data-sonner-toast]').allInnerTexts();
const stored = page => page.evaluate(k => { try { const v = JSON.parse(localStorage.getItem(k) ?? '[]'); return Array.isArray(v) ? v : null; } catch { return null; } }, KEY);
async function saveNamed(page, name) {
  await page.getByPlaceholder(/견적서 이름/).fill(name);
  await saveButton(page).click();
  await page.waitForTimeout(500);
}

/** PDF 쪽마다 검색어별 일치 수(검색어 순서). pymupdf search_for 를 쓴다. */
function pdfHits(pdfPath, queries) {
  const code = 'import fitz,sys,json\nd=fitz.open(sys.argv[1]);q=json.loads(sys.argv[2])\nprint(json.dumps({"pages":len(d),"hits":[[len(p.search_for(x)) for x in q] for p in d],"text":[p.get_text() for p in d]}))';
  const r = runPython(['-I', '-c', code, pdfPath, JSON.stringify(queries)]);
  if (r.status !== 0) throw new Error('pymupdf 실행 실패: ' + (r.stderr ?? ''));
  return JSON.parse(r.stdout);
}

try {
  const browser = await launchBrowser(chromium);
  try {
    // ---- D1: 깨진 저장소 ------------------------------------------------------------------
    const bad = JSON.stringify([validEntry('x', 'n')].map(({ meta, ...rest }) => rest)); // meta 없음
    const noItems = JSON.stringify([validEntry('y', 'n')].map(({ items, ...rest }) => rest)); // items 없음
    const cases = [
      ['객체 {"a":1}', '{"a":1}', 0],
      ['null', 'null', 0],
      ['[null]', '[null]', 0],
      ['meta 없는 항목', bad, 0],
      ['items 없는 항목', noItems, 0],
      ['정상+깨진 혼합', JSON.stringify([null, validEntry('ok1', '정상견적'), { id: 'bad' }]), 1],
      ['잘못된 savedAt', JSON.stringify([validEntry('d', '날짜불량견적', 'garbage')]), 1],
    ];
    for (const [label, seed, expectRows] of cases) {
      const { ctx, page, errors } = await newPage(browser, seed);
      try {
        const ok = await appRenders(page, vite.base);
        check('D1', `${label}: 앱이 그려진다`, ok, ok ? '' : `흰 화면 pageerror=${errors[0] ?? '(없음)'}`);
        if (ok) {
          await openPanel(page);
          const n = await rowCount(page);
          check('D1', `${label}: 유효한 항목만 ${expectRows}개`, n === expectRows, `행 ${n}`);
          const text = await page.locator('ul').allInnerTexts();
          check('D1', `${label}: Invalid Date 문구 없음`, !/Invalid Date/.test(text.join('\n')));
          await page.reload();
          const again = await appRenders(page, vite.base);
          check('D1', `${label}: 새로고침 뒤에도 그려진다`, again);
        }
      } catch (e) { check('D1', `${label}: 시나리오가 예외 없이 끝난다`, false, String(e.message ?? e).split(String.fromCharCode(10))[0]); } finally { await ctx.close(); }
    }

    // ---- D2: 저장 공간 부족 ---------------------------------------------------------------
    {
      const { ctx, page } = await newPage(browser, null);
      try {
        await appRenders(page, vite.base);
        await openPanel(page);
        // localStorage 를 한계까지 채운다(큰 조각부터 1글자 조각까지).
        const filled = await page.evaluate(() => {
          let n = 0;
          const fill = size => { try { for (;;) { localStorage.setItem('qb_fill_' + n, 'x'.repeat(size)); n++; } } catch { /* 가득 참 */ } };
          [100000, 1000, 10, 1].forEach(fill);
          return n;
        });
        await saveNamed(page, '공간부족견적');
        const t = (await toasts(page)).join('\n');
        check('D2', '저장 실패 안내 토스트가 뜬다', /저장 공간|저장하지 못/.test(t), t.replace(/\n/g, ' | ').slice(0, 120));
        check('D2', '「저장되었습니다」 토스트가 뜨지 않는다', !/저장되었습니다/.test(t));
        const n = await rowCount(page);
        check('D2', '실패한 견적서가 목록에 들어가지 않는다', n === 0, `행 ${n} (채운 조각 ${filled}개)`);
        const inStore = await stored(page);
        check('D2', '저장소에도 없다', Array.isArray(inStore) && inStore.length === 0);
        await page.reload();
        await appRenders(page, vite.base);
        await openPanel(page);
        const after = await rowCount(page);
        check('D2', '새로고침 뒤 화면과 저장소가 같다(0개)', after === 0, `행 ${after}`);
      } catch (e) { check('D2', '시나리오가 예외 없이 끝난다', false, String(e.message ?? e).split(String.fromCharCode(10))[0]); } finally { await ctx.close(); }
    }

    // ---- D3 + M2(토스트): 탭 두 개 ----------------------------------------------------------
    {
      const { ctx, page: p1 } = await newPage(browser, null);
      try {
        await appRenders(p1, vite.base);
        const p2 = await ctx.newPage();
        await p2.addInitScript(() => { try { delete window.showSaveFilePicker; delete Window.prototype.showSaveFilePicker; } catch { /* 이미 없음 */ } });
        await appRenders(p2, vite.base); // p2 는 목록이 비어 있을 때 마운트된다
        const longName = '가'.repeat(60);
        await openPanel(p1);
        await saveNamed(p1, longName);
        const t1 = (await toasts(p1)).join('\n');
        check('M2', '토스트가 긴 이름을 30자 + … 로 줄인다', t1.includes('가'.repeat(30) + '…') && !t1.includes('가'.repeat(31)), t1.replace(/\n/g, ' ').slice(0, 90));
        await closePanel(p1);
        await openPanel(p2);
        await saveNamed(p2, '탭2견적');
        const names = (await stored(p1) ?? []).map(q => q.name);
        check('D3', '두 탭이 저장한 견적서가 둘 다 저장소에 남는다', names.length === 2 && names.includes('탭2견적') && names.includes(longName), `저장소 ${names.length}개`);
        await openPanel(p1);
        const n1 = await rowCount(p1);
        check('D3', '다른 탭의 저장이 이 탭 목록에 따라온다(새로고침 없이)', n1 === 2, `행 ${n1}`);
      } catch (e) { check('D3', '시나리오가 예외 없이 끝난다', false, String(e.message ?? e).split(String.fromCharCode(10))[0]); } finally { await ctx.close(); }
    }

    // ---- D4 + M3: 구분 이름 왕복과 병합 PDF 글자 층 -----------------------------------------------
    {
      const { ctx, page } = await openAndFill(browser, vite.base);
      try {
        await page.addStyleTag({ content: '[data-sonner-toaster]{pointer-events:none}' });
        const setSaasLabel = async value => {
          await page.getByRole('button', { name: /항목/ }).first().click();
          await page.locator('button[title="카테고리 라벨 편집"]').click();
          await page.locator('input[placeholder="라벨 입력"]').first().fill(value);
          await page.mouse.click(5, 5); // 바깥을 눌러 편집창을 닫는다
          await page.waitForTimeout(300);
        };
        const previewText = () => page.evaluate(() => document.querySelector('#pdf-preview-panel')?.textContent ?? '');
        const A = '구독A문서', B = '구독B문서';
        await setSaasLabel(A);
        await openPanel(page); await saveNamed(page, '라벨A'); await closePanel(page);
        await setSaasLabel(B);
        await openPanel(page); await saveNamed(page, '라벨B'); await closePanel(page);
        check('D4', '현재 화면 구분 이름은 B', (await previewText()).includes(B));

        // 불러오기: A 를 불러오면 A 의 구분 이름이 돌아와야 한다.
        await openPanel(page);
        await page.locator('ul > li', { hasText: '라벨A' }).getByRole('button', { name: '불러오기' }).click();
        await page.getByRole('button', { name: '확인', exact: true }).click();
        await page.waitForTimeout(500);
        const afterLoad = await previewText();
        check('D4', '불러오면 저장 당시 구분 이름(A)이 돌아온다', afterLoad.includes(A) && !afterLoad.includes(B), `A=${afterLoad.includes(A)} B=${afterLoad.includes(B)}`);

        // M3 단일 PDF
        const QUERIES = ['사업자등록번호 108-81-85184', '신한은행 100-024-398749', '조병철 프로', '견적서', '합계', 'FORCS-EFS-BC-', '대금지불조건: 세금계산서 발행 후 30일이내 현금 또는 카드결제'];
        const single = join(OUT, 'single.pdf');
        await downloadTo(page, () => page.locator('button[title="PDF / 인쇄"]').click(), single);
        const s = pdfHits(single, QUERIES);
        QUERIES.forEach((q, i) => check('M3', `단일 PDF 에서 「${q}」 검색`, s.hits.every(h => h[i] >= 1), `쪽별 ${s.hits.map(h => h[i]).join(',')}`));

        // 병합 PDF: A, B 순서
        await openPanel(page);
        for (const nm of ['라벨A', '라벨B']) {
          await page.locator('ul > li', { hasText: nm }).locator('button').first().click();
          await page.waitForTimeout(150);
        }
        const merged = join(OUT, 'merged.pdf');
        await downloadTo(page, () => page.getByRole('button', { name: /병합 PDF/ }).last().click(), merged, 300000);
        const m = pdfHits(merged, [...QUERIES, A, B]);
        check('M3', '병합 PDF 가 2쪽', m.pages === 2, `쪽 ${m.pages}`);
        QUERIES.forEach((q, i) => check('M3', `병합 PDF 모든 쪽에서 「${q}」 검색`, m.hits.length > 0 && m.hits.every(h => h[i] >= 1), `쪽별 ${m.hits.map(h => h[i]).join(',')}`));
        const ia = QUERIES.length, ib = QUERIES.length + 1;
        check('D4', '병합 PDF 1쪽은 A 의 구분 이름, 2쪽은 B 의 구분 이름', m.hits[0]?.[ia] >= 1 && m.hits[0]?.[ib] === 0 && m.hits[1]?.[ib] >= 1 && m.hits[1]?.[ia] === 0, `1쪽 A${m.hits[0]?.[ia]} B${m.hits[0]?.[ib]} / 2쪽 A${m.hits[1]?.[ia]} B${m.hits[1]?.[ib]}`);
      } catch (e) { check('D4', '시나리오가 예외 없이 끝난다', false, String(e.message ?? e).split(String.fromCharCode(10))[0]); } finally { await ctx.close(); }
    }

    // ---- D5 + M1 + M2(행): 가득 찬 목록 -----------------------------------------------------------
    {
      const longName = '아주긴견적서이름'.repeat(12);
      const list = [
        validEntry('dup1', '같은이름', '2026-11-13T05:05:00.000Z'),
        validEntry('dup2', '같은이름', '2026-11-13T05:41:00.000Z'),
        validEntry('long', longName, '2026-11-13T06:00:00.000Z', { meta: { customerName: '긴이름고객주식회사' } }),
        ...Array.from({ length: LIMIT - 3 }, (_, i) => validEntry(`n${i}`, `견적${i}`)),
      ];
      const { ctx, page } = await newPage(browser, JSON.stringify(list));
      try {
        await appRenders(page, vite.base);
        await openPanel(page);
        const btn = saveButton(page);
        await page.getByPlaceholder(/견적서 이름/).fill('스물한번째');
        const disabled = await btn.isDisabled();
        const titleAttr = await btn.getAttribute('title');
        check('D5', '가득 차면 저장 버튼이 비활성', disabled);
        check('D5', '버튼 설명에 이유가 있다', /최대 20개/.test(titleAttr ?? ''), String(titleAttr));
        const panelText = await page.locator('div.fixed').first().innerText();
        check('D5', '패널에 이유 문구가 보인다', /최대 20개까지 저장할 수 있습니다/.test(panelText));
        await page.getByPlaceholder(/견적서 이름/).press('Enter');
        await page.waitForTimeout(400);
        const t = (await toasts(page)).join('\n');
        check('D5', '저장을 시도하면 거절 토스트가 뜬다', /최대 20개/.test(t), t.replace(/\n/g, ' ').slice(0, 100));
        const after = (await stored(page)) ?? [];
        check('D5', '20개 그대로, 가장 오래된 견적서도 그대로', after.length === LIMIT && after.some(q => q.id === 'n0') && !after.some(q => q.name === '스물한번째'), `저장소 ${after.length}개`);

        // M1: 같은 이름 두 행이 구분된다
        const dupTexts = await page.locator('ul > li', { hasText: '같은이름' }).allInnerTexts();
        check('M1', '같은 이름 두 행이 날짜와 시각(HH:mm)으로 구분된다', dupTexts.length === 2 && dupTexts.every(x => /\d{2}:\d{2}/.test(x)) && dupTexts[0] !== dupTexts[1], dupTexts.map(x => x.replace(/\n/g, ' ')).join(' / ').slice(0, 120));

        // M2: 긴 이름이 행을 밀어내지 않는다
        const geo = await page.evaluate(full => {
          const li = [...document.querySelectorAll('ul > li')].find(el => el.textContent.includes('아주긴견적서이름'));
          const name = li.querySelector('span.truncate');
          const btn = [...li.querySelectorAll('button')].find(b => b.textContent.trim() === '불러오기');
          const lr = li.getBoundingClientRect(), br = btn.getBoundingClientRect();
          return {
            titleOk: name.getAttribute('title') === full, ellipsized: name.scrollWidth > name.clientWidth,
            rowOverflow: li.scrollWidth - li.clientWidth, btnInside: br.width > 0 && br.right <= lr.right + 0.5 && br.left >= lr.left,
            custVisible: !!li.textContent.includes('긴이름고객'),
          };
        }, longName);
        check('M2', '긴 이름 행: 이름에 title(전체 이름)이 있다', geo.titleOk);
        check('M2', '긴 이름 행: 이름이 말줄임표로 잘린다', geo.ellipsized);
        check('M2', '긴 이름 행: 불러오기 버튼이 행 안에 보인다', geo.btnInside && geo.rowOverflow <= 1, `넘침 ${geo.rowOverflow}px`);
        await page.screenshot({ path: join(OUT, 'full-list.png') });
      } catch (e) { check('D5', '시나리오가 예외 없이 끝난다', false, String(e.message ?? e).split(String.fromCharCode(10))[0]); } finally { await ctx.close(); }
    }

    // ---- S: 저장 목록 검색 -------------------------------------------------------------------------
    {
      const { ctx, page } = await openAndFill(browser, vite.base, { customer: '(주)한빛물산' });
      const consoleErrors = [];
      page.on('pageerror', e => consoleErrors.push(String(e.message ?? e)));
      page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      try {
        await page.addStyleTag({ content: '[data-sonner-toaster]{pointer-events:none}' });
        const search = page.getByTestId('saved-search-input');
        const countText = async () => ((await page.getByTestId('saved-search-count').count()) ? await page.getByTestId('saved-search-count').innerText() : '');
        const visibleNames = async () => (await page.getByTestId('saved-name').allInnerTexts());
        const typeQuery = async q => { await search.fill(q); await page.waitForTimeout(150); };

        // 고객사가 다른 견적서 3개를 저장한다(구분 이름은 같다).
        await openPanel(page); await saveNamed(page, '검색A'); await closePanel(page);
        await fillBasic(page, '대한상사');
        await openPanel(page); await saveNamed(page, '검색B'); await closePanel(page);
        await fillBasic(page, '새롬정밀');
        await openPanel(page); await saveNamed(page, '검색C');
        check('S', '저장된 견적서 3개', (await rowCount(page)) === 3);
        check('S', '검색어가 없으면 개수 문구가 없다', (await countText()) === '');
        check('S', '입력창 안내 문구', (await search.getAttribute('placeholder')) === '이름·고객사·견적번호로 검색');

        await typeQuery('한빛');
        let names = await visibleNames();
        check('S', '고객사 「한빛」: 해당 행만 보인다', names.length === 1 && names[0] === '검색A', names.join(','));
        check('S', '개수 문구 「검색 결과 1건 / 전체 3건」', (await countText()) === '검색 결과 1건 / 전체 3건', await countText());
        await page.screenshot({ path: join(OUT, 'search-filtered.png') });

        await typeQuery('한빛'.normalize('NFD'));
        check('S', 'NFD 로 입력해도 NFC 이름·고객사를 찾는다', (await rowCount(page)) === 1, `행 ${await rowCount(page)}`);
        await typeQuery('대 한 상 사');
        names = await visibleNames();
        check('S', '공백은 무시한다(「대 한 상 사」→ 대한상사)', names.length === 1 && names[0] === '검색B', names.join(','));
        await typeQuery('검색');
        check('S', '이름 「검색」: 3개 모두, 순서는 그대로(최신순)', (await rowCount(page)) === 3 && (await countText()) === '검색 결과 3건 / 전체 3건');
        const order = await visibleNames();
        check('S', '목록 순서는 최신 저장이 위', order.join(',') === '검색C,검색B,검색A', order.join(','));

        for (const q of ['(', '+', '[', '*', '\\']) {
          await typeQuery(q);
        }
        await typeQuery('(');
        check('S', '「(」 검색: 오류 없음, 「(주)」 고객사 행이 보인다', consoleErrors.length === 0 && (await rowCount(page)) === 1, `오류 ${consoleErrors.length}건 ${consoleErrors[0] ?? ''} 행 ${await rowCount(page)}`);
        await typeQuery('+');
        check('S', '「+」 검색: 오류 없음, 결과 없음 안내', consoleErrors.length === 0 && (await page.getByTestId('saved-search-empty').count()) === 1);

        const LONG = '가나다라마바사아자차카타파하'.repeat(4);
        await typeQuery(LONG);
        const emptyText = await page.getByTestId('saved-search-empty').innerText();
        check('S', '결과 없음 문구(긴 검색어는 30자에서 줄임)', emptyText.includes('에 맞는 견적서가 없습니다.') && emptyText.includes(LONG.slice(0, 30) + '…') && !emptyText.includes(LONG.slice(0, 31)), emptyText.slice(0, 80));
        await typeQuery('없는이름zz');
        const none = await page.getByTestId('saved-search-empty').innerText();
        check('S', '결과 없음 문구 「‘없는이름zz’에 맞는 견적서가 없습니다.」', none.trim() === '‘없는이름zz’에 맞는 견적서가 없습니다.', none);
        check('S', '결과 없음일 때 개수 문구는 0건', (await countText()) === '검색 결과 0건 / 전체 3건', await countText());
        await page.screenshot({ path: join(OUT, 'search-empty.png') });

        await page.getByTestId('saved-search-clear').click();
        check('S', '지우기(×) 버튼: 검색어가 비고 3개가 돌아온다', (await search.inputValue()) === '' && (await rowCount(page)) === 3);
        check('S', '지우기 뒤 입력창에 포커스가 있다', await search.evaluate(el => el === document.activeElement));
        await typeQuery('한빛');
        await search.press('Escape');
        await page.waitForTimeout(150);
        check('S', 'Esc: 검색어가 비고 3개가 돌아온다', (await search.inputValue()) === '' && (await rowCount(page)) === 3);
        check('S', 'Esc 로 패널이 닫히지 않는다', (await page.getByPlaceholder(/견적서 이름/).count()) === 1);

        // 선택은 검색을 바꿔도 남는다. 가려진 선택이 있으면 알려 주고, 병합에도 들어간다.
        const checkbox = nm => page.locator('ul > li', { hasText: nm }).locator('button').first();
        await checkbox('검색A').click();   // 1번
        await typeQuery('대한');             // 검색B 만 보인다
        check('S', '선택한 A 가 검색 「대한」에 가려지면 안내가 보인다', (await page.getByTestId('hidden-selected-notice').count()) === 1);
        const notice = await page.getByTestId('hidden-selected-notice').innerText();
        check('S', '안내 문구 「검색에 가려진 선택 1건도 함께 병합됩니다.」', notice.trim() === '검색에 가려진 선택 1건도 함께 병합됩니다.', notice);
        await checkbox('검색B').click();   // 2번
        check('S', '가려진 선택 1건 + 보이는 선택 1건: 선택 2개 표시', (await page.getByText('2개 선택됨').count()) === 1);
        await typeQuery('한빛');             // 이제 B 가 가려진다
        check('S', '검색을 바꾸면 가려진 수도 바뀐다(B 가려짐 1건)', /가려진 선택 1건/.test(await page.getByTestId('hidden-selected-notice').innerText()));
        await typeQuery('');
        check('S', '검색어를 지우면 안내가 사라진다', (await page.getByTestId('hidden-selected-notice').count()) === 0);
        await typeQuery('새롬');             // A, B 둘 다 가려진다
        check('S', '선택 둘 다 가려지면 「2건」', /가려진 선택 2건/.test(await page.getByTestId('hidden-selected-notice').innerText()));

        const merged = join(OUT, 'merged-search.pdf');
        await downloadTo(page, () => page.getByRole('button', { name: /병합 PDF/ }).last().click(), merged, 300000);
        const m = pdfHits(merged, ['한빛물산', '대한상사', '새롬정밀']);
        check('S', '검색에 가려진 선택도 병합 PDF 에 들어간다(2쪽: A 한빛, B 대한, 선택 순서)', m.pages === 2 && m.hits[0][0] >= 1 && m.hits[0][1] === 0 && m.hits[1][1] >= 1 && m.hits[1][0] === 0, `쪽 ${m.pages} 1쪽 ${m.hits[0]} 2쪽 ${m.hits[1]}`);
        check('S', '선택하지 않은 견적 C 는 병합 PDF 에 없다(고객사 새롬정밀 없음)', m.hits.every(h => h[2] === 0), JSON.stringify(m.hits));

        // 닫았다가 다시 열면 검색어는 비어 있다.
        await page.waitForTimeout(600);
        if ((await page.getByPlaceholder(/견적서 이름/).count()) === 0) await openPanel(page);
        else { await closePanel(page); await openPanel(page); }
        check('S', '패널을 닫았다 열면 검색어가 비어 있다', (await page.getByTestId('saved-search-input').inputValue()) === '' && (await rowCount(page)) === 3);

        // 검색 중에 저장·삭제해도 필터가 유지된다.
        await typeQuery('대한');
        await saveNamed(page, '검색D');
        check('S', '필터 중 저장: 필터 유지, 새 견적(검색D)은 조건에 안 맞아 안 보인다', (await search.inputValue()) === '대한' && (await countText()) === '검색 결과 1건 / 전체 4건', await countText());
        await page.locator('ul > li', { hasText: '검색B' }).getByRole('button', { name: '삭제' }).click();
        await page.getByRole('button', { name: '삭제 확인' }).click();
        await page.waitForTimeout(300);
        check('S', '필터 중 삭제: 결과 없음 안내와 「0건 / 전체 3건」', (await page.getByTestId('saved-search-empty').count()) === 1 && (await countText()) === '검색 결과 0건 / 전체 3건', await countText());
        await typeQuery('검색D');
        check('S', '이름으로 새로 저장한 견적을 찾는다', (await rowCount(page)) === 1);
        check('S', '시나리오 내내 콘솔 오류 0건', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 120));
      } catch (e) { check('S', '시나리오가 예외 없이 끝난다', false, String(e.message ?? e).split(String.fromCharCode(10))[0]); } finally { await ctx.close(); }

      // 저장된 견적서가 0개이면 검색 입력이 없다.
      const { ctx: ctx0, page: p0 } = await newPage(browser, null);
      try {
        await appRenders(p0, vite.base);
        await openPanel(p0);
        check('S', '저장된 견적서가 0개면 검색 입력이 없고 기존 안내가 보인다', (await p0.getByTestId('saved-search-input').count()) === 0 && (await p0.getByText('저장된 견적서가 없습니다.').count()) === 1);
      } catch (e) { check('S', '0개 시나리오가 예외 없이 끝난다', false, String(e.message ?? e).split(String.fromCharCode(10))[0]); } finally { await ctx0.close(); }
    }
  } finally {
    await browser.close();
  }
} finally {
  vite.stop();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
}

const failed = results.filter(r => !r.ok);
console.log(`\n결과: ${failed.length === 0 ? 'PASS' : 'FAIL'} — ${results.length - failed.length}/${results.length} 통과`);
for (const f of failed) console.log(`  FAIL [${f.scenario}] ${f.name} ${f.detail}`);
process.exit(failed.length ? 1 : 0);
