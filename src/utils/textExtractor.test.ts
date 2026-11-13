// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./html2canvasMetrics', () => ({ measureBaselinePx: () => 10 }));

import { extractTextElements, withBoundarySpaces } from './textExtractor';

describe('withBoundarySpaces', () => {
  const none = { leading: false, trailing: false, prevEndsWithSpace: false };
  it('경계 공백이 없으면 글자를 바꾸지 않는다', () => {
    expect(withBoundarySpaces('108-81-85184', none)).toBe('108-81-85184');
    expect(withBoundarySpaces('사업자등록번호', none)).toBe('사업자등록번호');
  });
  it('끝 공백을 되살린다', () => {
    expect(withBoundarySpaces('사업자등록번호', { ...none, trailing: true })).toBe('사업자등록번호 ');
  });
  it('앞 공백은 앞 요소가 공백으로 끝나지 않을 때만 넣는다', () => {
    expect(withBoundarySpaces('프로', { ...none, leading: true })).toBe(' 프로');
    expect(withBoundarySpaces('프로', { ...none, leading: true, prevEndsWithSpace: true })).toBe('프로');
  });
  it('이미 공백이 있으면 겹쳐 넣지 않는다', () => {
    expect(withBoundarySpaces('a ', { ...none, trailing: true })).toBe('a ');
  });
});

// jsdom 은 레이아웃을 계산하지 않으므로 Range 의 사각형을 직접 정한다.
// 글자 하나 = 폭 5px, 한 줄 = top 0. collapsedWs 가 true 면 공백 문자를 접힌 공백(폭 0)처럼 돌려준다.
describe('extractTextElements 경계 공백', () => {
  let collapsedWs = false;
  const rect = (width: number, left: number): DOMRect =>
    ({ width, height: 10, top: 0, bottom: 10, left, right: left + width, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

  beforeEach(() => {
    collapsedWs = false;
    Range.prototype.getBoundingClientRect = function (this: Range) {
      const text = this.toString();
      const isSpace = text.length > 0 && text.trim() === '';
      // left = 컨테이너 시작부터 이 범위 앞까지의 글자 수 x 5px (노드마다 위치가 달라야 중복 제거에 걸리지 않는다)
      const before = document.createRange();
      before.selectNodeContents(document.getElementById('c') as HTMLElement);
      before.setEnd(this.startContainer, this.startOffset);
      return rect(isSpace && collapsedWs ? 0 : 5 * Math.max(text.length, 1), 5 * before.toString().length);
    };
    Range.prototype.getClientRects = function (this: Range) {
      return [this.getBoundingClientRect()] as unknown as DOMRectList;
    };
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  const containerRect = { left: 0, top: 0, width: 100, height: 100 } as DOMRect;
  const run = (html: string): string => {
    document.body.innerHTML = `<style>*{opacity:1}</style><div id="c">${html}</div>`;
    const c = document.getElementById('c') as HTMLElement;
    return extractTextElements(c, containerRect, 1)
      .map(e => e.text)
      .join('');
  };

  it('텍스트 노드 끝 공백: 「사업자등록번호 」+ span 번호를 이으면 공백이 남는다', () => {
    expect(run('<p>사업자등록번호 <span>108-81-85184</span></p>')).toBe('사업자등록번호 108-81-85184');
  });

  it('요소 사이 공백뿐인 노드: <b>신한은행</b> <span>계좌</span>', () => {
    expect(run('<p><b>신한은행</b> <span>140-013-452417</span></p>')).toBe('신한은행 140-013-452417');
  });

  it('공백이 없는 이웃은 붙여 둔 그대로다(숫자·한글 어절 안에 공백을 넣지 않는다)', () => {
    expect(run('<p><span>108</span>-<span>81</span>-<span>85184</span></p>')).toBe('108-81-85184');
    expect(run('<p><span>조병</span><span>철</span></p>')).toBe('조병철');
  });

  it('화면에서 접힌 공백(폭 0)은 되살리지 않는다', () => {
    collapsedWs = true;
    expect(run('<p>사업자등록번호 <span>108-81-85184</span></p>')).toBe('사업자등록번호108-81-85184');
  });

  it('경계 공백이 두 노드에 걸쳐도 한 번만 들어간다', () => {
    expect(run('<p>이름 <span> 프로</span></p>')).toBe('이름 프로');
  });
});
