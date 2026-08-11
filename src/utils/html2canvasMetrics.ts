/**
 * html2canvas가 "실제로" 텍스트를 어디에 그리는지 알려주는 모듈.
 *
 * ─── 왜 필요한가 ────────────────────────────────────────────────────────────
 * PDF는 html2canvas 래스터 이미지 위에 투명 텍스트 레이어를 얹는다.
 * 텍스트 레이어가 DOM 기하로 계산되고 이미지가 html2canvas로 그려지므로,
 * 두 좌표계가 어긋나면 드래그 선택 영역이 글자 위/아래로 밀린다.
 *
 * html2canvas(v1.4.1)는 글리프 baseline을
 *     y = Range.getClientRects().top + FontMetrics.baseline
 * 위치에 그린다. 그리고 FontMetrics.baseline은 폰트 지표를 읽는 게 아니라
 * 임시 <span>(텍스트)과 1x1 <img>(vertical-align:baseline)를 한 줄에 놓고
 *     baseline = img.offsetTop - span.offsetTop + 2
 * 로 "측정"한다. 정상이라면 결과는 (폰트 ascent + 1px)이다.
 *
 * ─── 실측으로 확인된 결함 ───────────────────────────────────────────────────
 * Tailwind preflight는 전역으로 `img { display: block }`을 건다. 그러면 위 탐침
 * <img>가 인라인이 아니라 블록이 되어 span 아래 줄로 떨어지고, 측정값이
 * (첫 줄 line box 높이 - span half-leading + 2) ≈ 1.32 × fontSize + 2 로 부풀어
 * 오른다. 결과적으로 html2canvas는 모든 텍스트를 (탐침값 - 정상값) ≈ 0.46 × fontSize
 * 만큼 아래로 그린다.
 *
 * 실측 (NanumSquare, ascent 0.857em, 견적서 프리뷰 기준).
 * "래스터 하강량"은 같은 요소를 fix 없이 / fix 걸고 각각 html2canvas로 그린 뒤
 * 캔버스 픽셀에서 글리프 잉크 상단을 재서 얻은 값이다 (DOM 계산값이 아니다):
 *     fontSize  탐침 baseline   정상값(asc+1)   래스터 하강량
 *       12px         18              11            +7px
 *       13px         20              12            +8px
 *       14px         21              13            +8px
 *       18px         26              16           +10px
 *       20px         28              18           +10px
 *       30px         42              27           +15px
 * 하강량은 정확히 (탐침값 - 정상값)과 일치한다. 프리뷰 축척(pxToMm ≈ 0.171)에서
 * 이는 1.2mm(12px) ~ 2.6mm(30px)에 해당한다.
 *
 * 이것이 "PDF 글자가 미리보기보다 아래에 찍힌다"와
 * "드래그 선택 영역이 글자 위에 있다"의 단일 원인이다.
 *
 * ─── 대응 ──────────────────────────────────────────────────────────────────
 * 1) installFontMetricsFix(): 캡처 동안만 탐침 <img>를 인라인으로 되돌린다.
 *    → html2canvas가 미리보기와 같은 위치에 글자를 그린다.
 * 2) measureBaselinePx(): 텍스트 레이어도 "html2canvas와 똑같은 방식"으로
 *    baseline을 측정해서 쓴다. 폰트 지표를 따로 추정하지 않으므로, 1)이
 *    (예: html2canvas 업그레이드로) 동작하지 않게 되더라도 이미지와 텍스트
 *    레이어는 여전히 서로 붙어 있다.
 *
 * 두 함수는 반드시 같은 CSS 상태에서 호출되어야 한다 (exportPdf가 보장).
 */

/** html2canvas가 쓰는 것과 동일한 1x1 투명 GIF */
const PROBE_IMAGE =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
/** html2canvas가 쓰는 것과 동일한 샘플 텍스트 */
const PROBE_TEXT = 'Hidden Text';

/**
 * html2canvas의 baseline 탐침 <img>만 정확히 겨냥해 인라인으로 되돌린다.
 *
 * 탐침은 body 바로 아래에 id/class 없는 <div>를 만들고 그 안에
 * `<img width="1" height="1" style="...vertical-align:baseline">`를 넣는다.
 * 앱의 실제 이미지는 모두 `#root` 하위에 있으므로 이 선택자에 걸리지 않는다.
 * vertical-align은 건드리지 않는다 (html2canvas가 'super'로 바꿔서 재는
 * `middle` 지표를 망가뜨리지 않기 위해).
 */
const FONT_METRICS_FIX_CSS =
    'body > div:not([id]):not([class]) > img[width="1"][height="1"]{display:inline !important}';

const FIX_STYLE_ID = 'h2c-font-metrics-fix';

/** 현재 fix 스타일이 붙어 있는지 (캐시 키에 반영) */
function isFixInstalled(): boolean {
    return typeof document !== 'undefined' && !!document.getElementById(FIX_STYLE_ID);
}

/**
 * 캡처 구간 동안 fix 스타일을 설치한다.
 * @returns 원상복구 함수 (반드시 finally에서 호출)
 */
export function installFontMetricsFix(): () => void {
    if (typeof document === 'undefined') return () => { };
    if (document.getElementById(FIX_STYLE_ID)) return () => { };

    const style = document.createElement('style');
    style.id = FIX_STYLE_ID;
    style.textContent = FONT_METRICS_FIX_CSS;
    document.head.appendChild(style);
    // 설치 전 값이 남아 있으면 안 되므로 캐시를 비운다
    baselineCache.clear();

    let removed = false;
    return () => {
        if (removed) return;
        removed = true;
        style.remove();
        baselineCache.clear();
    };
}

const baselineCache = new Map<string, number>();

/**
 * html2canvas의 FontMetrics.parseMetrics와 "동일한 방식"으로
 * line box(글리프 박스) 상단에서 baseline까지의 거리를 px로 잰다.
 *
 * @param fontFamily computed font-family (예: 'NanumSquare, "Noto Sans KR", sans-serif')
 * @param fontSize   computed font-size   (예: '14px')
 */
export function measureBaselinePx(fontFamily: string, fontSize: string): number {
    const key = `${fontFamily} ${fontSize}${isFixInstalled() ? ' #fix' : ''}`;
    const cached = baselineCache.get(key);
    if (cached !== undefined) return cached;

    const value = probeBaselinePx(fontFamily, fontSize);
    baselineCache.set(key, value);
    return value;
}

function probeBaselinePx(fontFamily: string, fontSize: string): number {
    const fontSizePx = parseFloat(fontSize) || 12;
    let measured = NaN;

    if (typeof document !== 'undefined' && document.body) {
        const container = document.createElement('div');
        const img = document.createElement('img');
        const span = document.createElement('span');

        container.style.visibility = 'hidden';
        container.style.fontFamily = fontFamily;
        container.style.fontSize = fontSize;
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.whiteSpace = 'nowrap';
        document.body.appendChild(container);

        img.src = PROBE_IMAGE;
        img.width = 1;
        img.height = 1;
        img.style.margin = '0';
        img.style.padding = '0';
        img.style.verticalAlign = 'baseline';

        span.style.fontFamily = fontFamily;
        span.style.fontSize = fontSize;
        span.style.margin = '0';
        span.style.padding = '0';
        span.appendChild(document.createTextNode(PROBE_TEXT));

        container.appendChild(span);
        container.appendChild(img);

        measured = img.offsetTop - span.offsetTop + 2;

        document.body.removeChild(container);
    }

    // 탐침이 말이 되는 값을 못 냈을 때(jsdom 등 레이아웃 없는 환경)의 대비책.
    // 정상 범위는 대략 0.5em ~ 2em + 여유. 이 범위는 위에서 설명한 "부풀어 오른"
    // 값(1.32em + 2)도 그대로 통과시킨다 — 이미지와 텍스트 레이어가 같은 값을
    // 쓰는 것이 (둘 다 이상적인 값을 쓰는 것보다) 정렬에 더 중요하기 때문이다.
    if (!isFinite(measured) || measured < fontSizePx * 0.5 || measured > fontSizePx * 2 + 4) {
        measured = fallbackBaselinePx(fontSizePx, fontFamily, fontSize);
    } else if (isFixInstalled()) {
        // fix가 걸린 상태라면 탐침값은 (ascent + 1)이어야 한다. 크게 벗어나면
        // 선택자가 더 이상 html2canvas의 탐침에 맞지 않는다는 뜻이다
        // (= 글자가 다시 아래로 밀려 찍힌다). 정렬 자체는 유지되지만 알려준다.
        const ideal = fallbackBaselinePx(fontSizePx, fontFamily, fontSize);
        if (Math.abs(measured - ideal) > Math.max(2, fontSizePx * 0.1)) {
            console.warn(
                `[html2canvasMetrics] baseline probe ${measured}px vs expected ~${ideal.toFixed(1)}px ` +
                `(${fontSize} ${fontFamily}). html2canvas의 폰트 지표 탐침 보정이 먹지 않는 것 같다 — ` +
                `이미지의 글자가 미리보기보다 아래로 찍힐 수 있다.`
            );
        }
    }

    return measured;
}

/** Canvas 폰트 지표 기반 대비책 (ascent + html2canvas의 +1px) */
function fallbackBaselinePx(fontSizePx: number, fontFamily: string, fontSize: string): number {
    try {
        const ctx = document.createElement('canvas').getContext('2d');
        if (ctx) {
            ctx.font = `${fontSize} ${fontFamily}`;
            const ascent = ctx.measureText(PROBE_TEXT).fontBoundingBoxAscent;
            if (isFinite(ascent) && ascent > 0) return ascent + 1;
        }
    } catch {
        // canvas 미지원 환경
    }
    // 마지막 대비책: 흔한 한글/라틴 폰트의 ascent 근사치
    return fontSizePx * 0.86 + 1;
}
