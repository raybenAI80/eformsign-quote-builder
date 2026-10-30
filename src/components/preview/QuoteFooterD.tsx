import React from 'react';
import type { QuoteFooterKind } from './quoteFooterKind';

/**
 * 견적서 하단(푸터). 문구는 포시에스 강점 이미지와 소개서(4p 인증, 1p 슬로건)에서 글자 그대로 옮겼다.
 * 시안·설계 근거: docs/design-mode/footer-v2/DESIGN.md. 스타일은 quotePreviewD.css 의 `.qd-foot` 이하.
 */
const EMBLEMS: Array<{ id: string; alt: string }> = [
  { id: 'csap', alt: 'CSAP' },
  { id: 'kip', alt: 'K-Innovative Product 혁신제품' },
  { id: 'gov', alt: '과학기술정보통신부' },
  { id: 'aws', alt: 'AWS Qualified Software' },
  { id: 'iso', alt: 'ISO 27001 27017 27018' },
  { id: 'gs', alt: 'GS 1등급' },
];

const Emblems: React.FC = () => (
  <>
    {EMBLEMS.map(e => (
      <img key={e.id} className="qd-emb" src={`/design-d/emblems/${e.id}.png`} alt={e.alt} />
    ))}
  </>
);

/**
 * 강점 4칸: 큰 수치 + 두 줄 설명.
 * 첫 칸 표식은 :first-child 가 아니라 클래스(qd-st-first)로 준다. PDF 캡처(html2canvas)는 ::before 를 첫 자식 요소로 끼워 넣어
 * 컨테이너에 ::before 가 있으면 :first-child 가 첫 칸에 맞지 않고, 그러면 래스터 글자가 텍스트 레이어보다 오른쪽으로 밀린다.
 */
const Strengths: React.FC = () => (
  <>
    <div className="qd-st qd-st-first">
      <b>31<i>년</i></b>
      <span>업력의<br />대표 SW 기업</span>
    </div>
    <div className="qd-st">
      <b>100%</b>
      <span>자체 기술력의<br />OZ 제품 시리즈</span>
    </div>
    <div className="qd-st">
      <b>업계 최초</b>
      <span>코스닥 상장</span>
    </div>
    <div className="qd-st">
      <b>50<i>여 개</i></b>
      <span>수상 및 인증</span>
    </div>
  </>
);

export const QuoteFooterD: React.FC<{ kind: QuoteFooterKind }> = ({ kind }) => {
  if (kind === 'public') {
    // F1 콜로폰: 서명 | 강점 4칸 | 엠블럼 한 줄
    return (
      <div className="qd-foot qd-foot-pub" data-footer="public">
        <div className="qd-sig">
          <p className="qd-sig-eye">For Client’s Success, FORCS</p>
          <h2 className="qd-sig-name">
            전자문서 전문 기업,<br />포시에스
          </h2>
        </div>
        <div className="qd-pub-str">
          <Strengths />
        </div>
        <div className="qd-pub-emb">
          <Emblems />
        </div>
      </div>
    );
  }
  // F2 브랜드 밴드: 왼쪽 위 엠블럼, 왼쪽 아래 강점, 오른쪽 네이비 밴드 + 일러스트
  return (
    <div className="qd-foot qd-foot-gen" data-footer="general">
      <div className="qd-gen-left">
        <div className="qd-gen-emb">
          <Emblems />
        </div>
        <div className="qd-gen-str">
          <Strengths />
        </div>
      </div>
      <div className="qd-band">
        <p className="qd-slogan">
          일 잘하는 사람들의<br />전자계약. 이폼사인
        </p>
      </div>
      <img className="qd-gen-ch" src="/design-d/intro-characters.png" alt="이폼사인 소개서 일러스트" />
    </div>
  );
};
