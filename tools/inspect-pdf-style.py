"""PDF 첫 쪽을 PNG 로 렌더하고 서식 적용 여부를 판정한다. 사용: python -I inspect-pdf-style.py <pdf> <out.png>
판정 지표: 쪽 수, 글자 수, 이미지 수·최대 이미지가 쪽에서 차지하는 비율, 비백색 픽셀 비율,
          한 줄 전체에 가까운 가로 선(표 테두리) 개수. 서식이 빠진 PDF 는 가로 선이 0 이고 이미지 면적이 비정상이다."""
import sys
import fitz

pdf, out = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf)
page = doc[0]
pix = page.get_pixmap(dpi=60)
pix.save(out)
w, h = pix.width, pix.height
s = pix.samples
n = pix.n
nonwhite = 0
rows_dark = 0
for y in range(h):
    row_dark = 0
    base = y * w * n
    for x in range(w):
        i = base + x * n
        if s[i] < 235 or s[i + 1] < 235 or s[i + 2] < 235:
            nonwhite += 1
            row_dark += 1
    if row_dark > w * 0.5:
        rows_dark += 1
imgs = page.get_images(full=True)
area = 0.0
for im in imgs:
    for r in page.get_image_rects(im[0]):
        area = max(area, r.width * r.height / (page.rect.width * page.rect.height))
text = page.get_text()
print(f"pages={len(doc)} chars={len(text)} images={len(imgs)} maxImgArea={area:.2f} nonwhite={nonwhite / (w * h):.3f} wideRows={rows_dark} size={w}x{h}")
