# PDF 쪽별 분석: 쪽 크기, 비배경 픽셀 비율, 글자 전체를 JSON 으로 출력하고 쪽 이미지를 저장한다.
# 사용: python -I tools/lib/pdf-pages.py <pdf> [<쪽 이미지 접두어>]   (접두어를 주면 <접두어>-p1.png ... 저장)
import json
import sys

import fitz

pdf = fitz.open(sys.argv[1])
prefix = sys.argv[2] if len(sys.argv) > 2 else None
pages = []
for i, page in enumerate(pdf):
    pix = page.get_pixmap(dpi=40, colorspace=fitz.csRGB)
    s = pix.samples
    n = pix.width * pix.height
    nonbg = sum(1 for k in range(0, len(s), 3) if s[k] < 245 or s[k + 1] < 245 or s[k + 2] < 245)
    if prefix:
        page.get_pixmap(dpi=70).save(f"{prefix}-p{i + 1}.png")
    pages.append({"w": round(page.rect.width, 1), "h": round(page.rect.height, 1), "nonbg": nonbg / n, "text": page.get_text()})
print(json.dumps({"pages": pages}))
