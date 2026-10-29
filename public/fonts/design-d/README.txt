견적서 디자인 D(비즈니스형) 글꼴 — 둘 다 SIL Open Font License 1.1

Paperlogy (6 SemiBold, 8 ExtraBold)
  출처: jsDelivr gh/projectnoonnu/2408-3@1.0 (폰트 제공 https://freesentation.blog/paperlogyfont)
  라이선스: 글꼴 파일 name 표(ID 13)에 SIL OFL 1.1 문구가 들어 있다.
Pretendard (Regular, SemiBold)
  출처: jsDelivr npm/pretendard@1.3.9
  라이선스: Pretendard-LICENSE.txt

*.woff2 = 화면 글꼴(@font-face 는 src/index.css). PretendardVariable.woff2(npm/pretendard@1.3.9 dist/web/variable)가 앱·출력물의 Pretendard 전 굵기를 맡는다. Pretendard-Regular/SemiBold.woff2 는 TTF 생성 원본
*.ttf   = PDF 텍스트 레이어(jsPDF, src/utils/fontLoader.ts). woff2 에서 tools/build-design-fonts.py 로 만든다.
