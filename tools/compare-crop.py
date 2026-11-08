"""화면 요소 스크린샷(기준)과 출력물(PDF 첫 쪽 또는 PNG)의 같은 영역을 비교한다.
사용: python -I compare-crop.py <기준 PNG> <출력물 .pdf|.png> <x> <y> <w> <h> <paperW> [--save <출력 크롭 PNG>]
  x,y,w,h = 용지(.qd-paper) 안의 영역(CSS px), paperW = 용지 CSS 폭. 기준 PNG 는 배율 1 로 찍은 요소 스크린샷.
출력 한 줄: diff=<다른 픽셀 비율> size=<가로x세로>. 두 이미지를 가볍게 흐린 뒤 밝기 차가 임계값을 넘는 픽셀의 비율이다.
글자 폭이 달라져 「원」이 숫자에 겹치면 글자 가장자리가 어긋나 이 값이 커진다. PYI 환경변수를 비운 셸에서 실행한다."""
import sys
import fitz
from PIL import Image, ImageFilter, ImageChops

args = [a for a in sys.argv[1:] if not a.startswith("--")]
save = None
if "--save" in sys.argv:
    save = sys.argv[sys.argv.index("--save") + 1]
    args = [a for a in args if a != save]
ref_path, out_path = args[0], args[1]
x, y, w, h, paper_w = (float(v) for v in args[2:7])

ref = Image.open(ref_path).convert("L")
SCALE = 1
if out_path.lower().endswith(".pdf"):
    page = fitz.open(out_path)[0]
    # 용지 이미지가 쪽 안에 놓인 사각형을 기준으로 삼는다(한 장 맞춤은 여백·축소가 있을 수 있다)
    rects = [r for im in page.get_images(full=True) for r in page.get_image_rects(im[0])]
    ir = max(rects, key=lambda r: r.width * r.height) if rects else page.rect
    pt_per_px = ir.width / paper_w
    zoom = SCALE / pt_per_px
    clip = fitz.Rect(ir.x0 + x * pt_per_px, ir.y0 + y * pt_per_px, ir.x0 + (x + w) * pt_per_px, ir.y0 + (y + h) * pt_per_px)
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, colorspace=fitz.csGRAY)
    out = Image.frombytes("L", (pix.width, pix.height), pix.samples)
else:
    full = Image.open(out_path).convert("L")
    k = full.width / paper_w
    out = full.crop((round(x * k), round(y * k), round((x + w) * k), round((y + h) * k)))
    if out.size != ref.size:
        out = out.resize(ref.size)
if out.size != ref.size:
    out = out.resize(ref.size)
if save:
    out.save(save)
a = ref.filter(ImageFilter.GaussianBlur(1.2))
b = out.filter(ImageFilter.GaussianBlur(1.2))
d = ImageChops.difference(a, b).point(lambda v: 255 if v > 60 else 0)
bad = sum(1 for v in d.getdata() if v)
print(f"diff={bad / (ref.width * ref.height):.4f} size={ref.width}x{ref.height}")
