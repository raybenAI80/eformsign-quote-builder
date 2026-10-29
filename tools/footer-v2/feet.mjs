// footer-v2 시안 마크업 3종(F1·F2·F3). 앱 구현은 src/components/preview/QuoteFooterD.tsx.
// PUB = 시안 HTML 에서 저장소 public/ 폴더로 가는 상대 경로(build.mjs 가 넘긴다).
// 푸터 마크업 3종. 문구는 소개서 4p(인증)·강점 이미지(forcs-strengths.png, 삭제됨)·1p 에서 글자 그대로 옮겼다.
export const makeFeet = (PUB) => {
const EMB = (k, alt) => `<img class="emb emb-${k}" src="${PUB}/design-d/emblems/${k}.png" alt="${alt}">`;
const EMBS = `${EMB('csap', 'CSAP')}${EMB('kip', 'K-Innovative Product 혁신제품')}${EMB('gov', '과학기술정보통신부')}${EMB('aws', 'AWS Qualified Software')}${EMB('iso', 'ISO 27001 27017 27018')}${EMB('gs', 'GS 1등급')}`;

return {
  // F1 콜로폰: 서명 | 강점 4칸 | 엠블럼 한 줄
  f1: `<div class="qd-foot fx f1">
    <div class="f1-sig">
      <p class="f1-eye">For Client’s Success, FORCS</p>
      <h2 class="f1-name">전자문서 전문 기업,<br>포시에스</h2>
    </div>
    <div class="f1-str">
      <div class="st"><b>31<i>년</i></b><span>업력의 대표<br>SW 기업</span></div>
      <div class="st"><b>100%</b><span>자체 기술력의<br>OZ 제품 시리즈</span></div>
      <div class="st"><b>업계 최초</b><span>코스닥 상장</span></div>
      <div class="st"><b>50<i>여 개</i></b><span>수상 및 인증</span></div>
    </div>
    <div class="f1-emb">${EMBS}</div>
  </div>`,

  // F2 브랜드 밴드: 왼쪽 위 강점, 왼쪽 아래(밴드 밑선 기준) 엠블럼, 오른쪽 네이비 밴드 + 일러스트
  f2: `<div class="qd-foot fx f2">
    <div class="f2-left">
      <div class="f2-emb">${EMBS}</div>
      <div class="f2-str">
        <div class="st"><b>31<i>년</i></b><span>업력의 대표<br>SW 기업</span></div>
        <div class="st"><b>100%</b><span>자체 기술력의<br>OZ 제품 시리즈</span></div>
        <div class="st"><b>업계 최초</b><span>코스닥 상장</span></div>
        <div class="st"><b>50<i>여 개</i></b><span>수상 및 인증</span></div>
      </div>
    </div>
    <div class="f2-band">
      <p class="f2-slogan">일 잘하는 사람들의<br>전자계약. 이폼사인</p>
    </div>
    <img class="f2-ch" src="${PUB}/design-d/intro-characters.png" alt="이폼사인 소개서 일러스트">
  </div>`,

  // F3 인증 원장: 강점 한 줄 + 6칸 원장
  f3: `<div class="qd-foot fx f3">
    <p class="f3-str">
      <span class="it"><b>31<i>년</i></b> 업력의 대표 SW 기업</span>
      <span class="it"><b>100%</b> 자체 기술력의 OZ 제품 시리즈</span>
      <span class="it">전자문서 시장 점유율 <b>1위</b></span>
      <span class="it"><b>업계 최초</b> 코스닥 상장</span>
    </p>
    <div class="f3-led">
      <div class="c"><span class="tag">업계 최초</span>${EMB('csap', 'CSAP')}<p>CSAP SaaS<br>표준 등급 획득</p></div>
      <div class="c"><span class="tag">업계 유일</span>${EMB('kip', 'K-Innovative Product 혁신제품')}<p>우수연구개발 혁신제품 지정<br>디지털서비스혁신제품 지정</p></div>
      <div class="c"><span class="tag">업계 유일</span>${EMB('gov', '과학기술정보통신부')}<p>공공부문 SW AWARD<br>과기부 장관상 수상</p></div>
      <div class="c"><span class="tag">업계 최초</span>${EMB('aws', 'AWS Qualified Software')}<p>AWS 인증<br>소프트웨어</p></div>
      <div class="c"><span class="tag none"></span>${EMB('iso', 'ISO 27001 27017 27018')}<p>국제표준 ISO 인증 획득<br>27001·27017·27018</p></div>
      <div class="c"><span class="tag none"></span>${EMB('gs', 'GS 1등급')}<p>SW 품질 인증<br>GS 1등급 획득</p></div>
    </div>
  </div>`,
};
};
