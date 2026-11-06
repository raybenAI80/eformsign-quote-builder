import { describe, expect, it } from 'vitest';
import { absolutizeCssUrls, inlineLinkedStylesheets, readSheetCssText, waitForCloneFonts } from './captureStyles';

function fakeSheet(href: string | null, rules: string[], ownerTag = 'LINK', ownerHref: string | null = href) {
    return {
        href,
        cssRules: rules.map(cssText => ({ cssText })),
        ownerNode: { tagName: ownerTag, getAttribute: (n: string) => (n === 'href' ? ownerHref : null) },
    } as unknown as CSSStyleSheet;
}

describe('absolutizeCssUrls', () => {
    it('resolves relative urls against the sheet address and keeps data/absolute urls', () => {
        const css = 'a{background:url(../img/a.png)} b{src:url("/fonts/x.woff2")} c{x:url(data:image/png;base64,AAA)} d{x:url(https://e.com/z.png)}';
        const out = absolutizeCssUrls(css, 'https://q.example/assets/index-1.css');
        expect(out).toContain('url(https://q.example/img/a.png)');
        expect(out).toContain('url("https://q.example/fonts/x.woff2")');
        expect(out).toContain('url(data:image/png;base64,AAA)');
        expect(out).toContain('url(https://e.com/z.png)');
    });
});

describe('readSheetCssText', () => {
    it('joins all rules', () => {
        const text = readSheetCssText(fakeSheet('https://q.example/a.css', ['.a{color:red}', '.b{color:blue}']));
        expect(text).toBe('.a{color:red}\n.b{color:blue}\n');
    });
    it('returns null when rules cannot be read (cross-origin sheet)', () => {
        const sheet = {
            href: 'https://other.example/x.css',
            get cssRules(): CSSRuleList {
                throw new DOMException('blocked', 'SecurityError');
            },
        } as unknown as CSSStyleSheet;
        expect(readSheetCssText(sheet)).toBeNull();
    });
});

describe('inlineLinkedStylesheets', () => {
    const makeClone = () => {
        const doc = document.implementation.createHTMLDocument('clone');
        doc.head.innerHTML =
            '<link rel="stylesheet" crossorigin href="/assets/index-OLD.css"><link rel="stylesheet" href="https://cdn.example/other.css"><link rel="icon" href="/x.png">';
        return doc;
    };

    it('replaces the matching stylesheet link with an inline style and leaves other links', () => {
        const clone = makeClone();
        const source = {
            styleSheets: [
                fakeSheet('https://q.example/assets/index-OLD.css', ['.qd-paper{width:297mm}'], 'LINK', '/assets/index-OLD.css'),
                fakeSheet(null, ['.dev{color:red}'], 'STYLE', null),
            ],
        } as unknown as Document;
        expect(inlineLinkedStylesheets(clone, source)).toBe(1);
        const styles = clone.head.querySelectorAll('style');
        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toContain('.qd-paper{width:297mm}');
        expect(clone.head.querySelector('link[href="/assets/index-OLD.css"]')).toBeNull();
        expect(clone.head.querySelector('link[href="https://cdn.example/other.css"]')).not.toBeNull();
        expect(clone.head.querySelector('link[rel="icon"]')).not.toBeNull();
    });

    it('does nothing when the source has no readable linked sheet (dev server uses style tags)', () => {
        const clone = makeClone();
        const source = { styleSheets: [fakeSheet(null, ['.dev{color:red}'], 'STYLE', null)] } as unknown as Document;
        expect(inlineLinkedStylesheets(clone, source)).toBe(0);
        expect(clone.head.querySelectorAll('style')).toHaveLength(0);
        expect(clone.head.querySelectorAll('link')).toHaveLength(3);
    });
});

describe('waitForCloneFonts', () => {
    function fakeDoc(faces: Array<{ load: () => Promise<unknown> }>, ready: Promise<unknown>) {
        return { fonts: Object.assign([...faces], { ready }), body: { offsetHeight: 0 } } as unknown as Document;
    }
    it('loads every declared face and waits for fonts.ready before returning', async () => {
        const order: string[] = [];
        const faces = [
            { load: () => new Promise(r => setTimeout(() => { order.push('a'); r(undefined); }, 10)) },
            { load: () => Promise.resolve().then(() => { order.push('b'); }) },
        ];
        const ready = new Promise(r => setTimeout(() => { order.push('ready'); r(undefined); }, 20));
        await waitForCloneFonts(fakeDoc(faces, ready));
        expect(order).toEqual(['b', 'a', 'ready']);
    });
    it('still returns when a face fails to load', async () => {
        const doc = fakeDoc([{ load: () => Promise.reject(new Error('404')) }], Promise.resolve());
        await expect(waitForCloneFonts(doc)).resolves.toBeUndefined();
    });
    it('gives up after the timeout when fonts never finish', async () => {
        const doc = fakeDoc([{ load: () => new Promise(() => {}) }], new Promise(() => {}));
        const t0 = Date.now();
        await waitForCloneFonts(doc, 50);
        expect(Date.now() - t0).toBeLessThan(1000);
    });
});
