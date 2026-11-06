/**
 * html2canvas 는 캡처 전에 문서를 숨은 iframe 에 복제한다. 운영 번들의 CSS 는 <link rel="stylesheet"> 라서
 * 복제본이 그 파일을 다시 내려받는다. 이 요청이 실패하면(앱을 연 채 새 배포가 나가 옛 해시 파일이 404 가 된 경우,
 * 오프라인, 네트워크 차단) 복제본에 CSS 가 없어 PDF·PNG 가 서식 없는 HTML 처럼 찍힌다.
 * 화면은 이미 로드된 CSS 로 정상이므로 사용자는 저장하기 전까지 알 수 없다.
 *
 * 해결: 화면 문서에 이미 로드된 시트의 규칙(CSSOM)을 복제본의 <link> 자리에 <style> 로 직접 넣는다.
 * 파일을 다시 받지 않으므로 네트워크 상태와 무관하다. 개발 서버는 처음부터 <style> 이라 영향이 없다.
 */

/** url(...) 안의 상대 경로를 시트 주소 기준 절대 주소로 바꾼다 (복제본 문서의 기준 주소가 다를 수 있다). */
export function absolutizeCssUrls(cssText: string, sheetHref: string | null): string {
    if (!sheetHref) return cssText;
    return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, quote: string, raw: string) => {
        const url = raw.trim();
        if (/^(data:|blob:|https?:|about:|#)/i.test(url)) return whole;
        try {
            return `url(${quote}${new URL(url, sheetHref).href}${quote})`;
        } catch {
            return whole;
        }
    });
}

/** 시트의 모든 규칙 글을 이어 붙인다. 교차 출처 시트처럼 규칙을 읽을 수 없으면 null. */
export function readSheetCssText(sheet: CSSStyleSheet): string | null {
    try {
        const rules = sheet.cssRules;
        let text = '';
        for (let i = 0; i < rules.length; i++) text += rules[i].cssText + '\n';
        return absolutizeCssUrls(text, sheet.href);
    } catch {
        return null;
    }
}

/**
 * 복제본 문서의 <link rel="stylesheet"> 를, 화면 문서에서 읽은 같은 시트의 <style> 로 바꾼다.
 * 규칙을 읽을 수 없는 시트의 link 는 그대로 둔다. 바꾼 개수를 돌려준다.
 */
export function inlineLinkedStylesheets(clonedDoc: Document, sourceDoc: Document = document): number {
    const inlined = new Map<string, string>();
    for (const sheet of Array.from(sourceDoc.styleSheets)) {
        const owner = sheet.ownerNode as Element | null;
        if (!owner || owner.tagName !== 'LINK') continue;
        const hrefAttr = owner.getAttribute('href');
        if (!hrefAttr) continue;
        const text = readSheetCssText(sheet);
        if (text !== null) inlined.set(hrefAttr, text);
    }
    if (inlined.size === 0) return 0;

    let replaced = 0;
    for (const link of Array.from(clonedDoc.querySelectorAll('link'))) {
        if (!/(^|\s)stylesheet(\s|$)/i.test(link.getAttribute('rel') ?? '')) continue;
        const text = inlined.get(link.getAttribute('href') ?? '');
        if (text === undefined) continue;
        const style = clonedDoc.createElement('style');
        style.textContent = text;
        link.replaceWith(style);
        replaced++;
    }
    return replaced;
}

/** 복제본의 글꼴 로드를 기다리는 최대 시간(ms). 글꼴 파일이 막혀도 저장은 이어져야 한다. */
const CLONE_FONT_WAIT_MS = 4000;

/**
 * 복제본에서 선언된 @font-face 를 전부 불러오고 끝날 때까지 기다린다.
 *
 * 왜 필요한가(2026-11-06 회귀): <link> 를 <style> 로 바꾸면 복제 문서가 스타일시트를 새로 받은 것으로 보고
 * 글꼴을 다시 내려받는다(FontFace 상태 loaded → loading). html2canvas 는 onclone 직후 바로 글자 위치를 재므로
 * 그 순간 복제본은 대체 글꼴로 배치돼 있고, 캔버스에는 실제 글꼴로 그려진다. 폭이 달라(「1,584,000원」 134.8px → 122.8px)
 * 「원」이 마지막 숫자 위에 겹친다. 글꼴이 이미 로드된 뒤에 배치가 계산되도록 여기서 기다린다.
 */
export async function waitForCloneFonts(clonedDoc: Document, timeoutMs: number = CLONE_FONT_WAIT_MS): Promise<void> {
    const fonts = clonedDoc.fonts;
    if (!fonts) return;
    const loading = Promise.all(
        Array.from(fonts).map(face => face.load().catch(() => undefined)),
    ).then(() => fonts.ready);
    await Promise.race([loading, new Promise(resolve => setTimeout(resolve, timeoutMs))]);
    // 글꼴이 준비된 뒤 배치를 한 번 확정한다
    void clonedDoc.body?.offsetHeight;
}

/** html2canvas onclone 에서 쓰는 한 묶음: CSS 를 화면 규칙으로 보장하고, 글꼴이 로드된 뒤에 캡처가 진행되게 한다. */
export async function prepareClonedDocument(clonedDoc: Document, sourceDoc: Document = document): Promise<void> {
    inlineLinkedStylesheets(clonedDoc, sourceDoc);
    await waitForCloneFonts(clonedDoc);
}
