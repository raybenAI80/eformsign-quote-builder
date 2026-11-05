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
