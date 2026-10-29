# foot-sheet.png, page-sheet.png, 그리고 0.69배 자가검열용 foot-069-*.png 생성
import json, os
from PIL import Image, ImageDraw, ImageFont
T=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.dirname(os.path.dirname(T))
OUT=os.path.join(ROOT,'docs','design-mode','footer-v2')  # 최종 시트
D=os.path.join(ROOT,'.work','footer-v2')  # build.mjs 중간 산출물
m=json.load(open(os.path.join(D,'measure.json'),encoding='utf8'))
F=lambda s,b=False: ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf' if b else 'C:/Windows/Fonts/malgun.ttf', s)
V=[('f1','F1 콜로폰'),('f2','F2 브랜드 밴드'),('f3','F3 인증 원장')]
S=0.69
rows=[]
for k,l in V:
    a=Image.open(os.path.join(D,f'{k}-foot@2x.png')).convert('RGB'); b=Image.open(os.path.join(D,f'{k}-foot.png')).convert('RGB')
    a=a.resize((round(1123*S),round(a.height/2*S)),Image.LANCZOS)
    a.save(os.path.join(D,f'foot-069-{k}.png'))
    rows.append((l,a,b,m[k]['footHeight']))
lw=round(1123*S); W=24+lw+36+1123+24
H=24+sum(36+max(a.height,b.height)+24 for _,a,b,_ in rows)
fs=Image.new('RGB',(W,H),(154,163,171)); d=ImageDraw.Draw(fs); y=24
for l,a,b,h in rows:
    d.text((24,y),f"{l} · {h:.0f}px",font=F(18,True),fill='white')
    d.text((24+lw+36,y+3),'원본 크기 (1123px 폭)',font=F(13),fill=(235,240,245))
    d.text((24,y+24),'0.69배(출력 크기)',font=F(12),fill=(235,240,245)) if False else None
    y+=36; fs.paste(a,(24,y)); fs.paste(b,(24+lw+36,y)); y+=max(a.height,b.height)+24
fs.save(os.path.join(OUT,'foot-sheet.png')); print('foot-sheet',fs.size)
# page sheet
colw=round(1123*S); gap=24; pad=24; head=44
ph=round(m['f1']['pageHeight']*S)
W=pad*2+colw*3+gap*2; H=head+ph+pad
ps=Image.new('RGB',(W,H),(154,163,171)); d=ImageDraw.Draw(ps)
for i,(k,l) in enumerate(V[1:]):
    x=pad+i*(colw+gap)
    d.text((x,12),f"{l} · 푸터 {m[k]['footHeight']:.0f}px · 쪽 {m[k]['pageHeight']:.0f}px (A4 세로 1쪽, 0.69배)",font=F(15,True),fill='white')
    im=Image.open(os.path.join(D,f'{k}@2x.png')).convert('RGB').resize((colw,ph),Image.LANCZOS)
    ps.paste(im,(x,head)); d.rectangle([x-1,head-1,x+colw,head+ph],outline=(60,70,80))
ps.save(os.path.join(D,'page-sheet.png')); print('page-sheet',ps.size)
