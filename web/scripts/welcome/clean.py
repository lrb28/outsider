"""Paint the reference video's overlays out of its silk and make one clean loop.

    python3 clean.py <workdir>

<workdir>/light and <workdir>/dark hold every frame of the two reference
videos, cropped to the phone screen (399×866, extract.swift). Writes
<workdir>/final_{light,dark}/c000…c059.png: the one-second loop (60 frames),
each frame the average of the video's five copies of it, with the clock,
island, status icons, logo, headline, buttons, home bar and the phone's
rounded corners painted out, cropped to 390×846. Needs numpy, opencv, Pillow.

How the overlays go away: they are the pixels that never move (text, logo)
plus fixed rectangles (island, buttons). Each hidden pixel is filled by
walking along the local direction of the silk's streaks to visible silk on
both sides and blending the two colours, so strands run on through the gap.
"""
import sys
import numpy as np, cv2, glob, os
from PIL import Image

S = sys.argv[1]
os.makedirs(f"{S}/work", exist_ok=True)

# ── 1. Temporal statistics: overlays are what never moves ──────────────────
for m in ["light", "dark"]:
    fs = sorted(glob.glob(f"{S}/{m}/f*.png"))
    L = np.stack([np.asarray(Image.open(f).convert("L"), dtype=np.float32) for f in fs])
    np.save(f"{S}/work/{m}_mean.npy", L.mean(0)); np.save(f"{S}/work/{m}_std.npy", L.std(0))

# ── 2. Masks ────────────────────────────────────────────────────────────────
H,W=866,399
def rounded_outside(r=57, border=2):
    m=np.zeros((H,W),np.uint8)
    inner=np.zeros((H,W),np.uint8)
    cv2.rectangle(inner,(r+border,border),(W-1-r-border,H-1-border),255,-1)
    cv2.rectangle(inner,(border,r+border),(W-1-border,H-1-r-border),255,-1)
    for cx,cy in [(r+border,r+border),(W-1-r-border,r+border),(r+border,H-1-r-border),(W-1-r-border,H-1-r-border)]:
        cv2.circle(inner,(cx,cy),r,255,-1)
    return (inner==0).astype(np.uint8)*255
for m in ['light','dark']:
    mean=np.load(f'{S}/work/{m}_mean.npy'); std=np.load(f'{S}/work/{m}_std.npy'); 
    if m=='light':
        glyph=(mean<150)&(std<30)
    else:
        glyph=(mean>110)&(std<30)
    glyph=glyph.astype(np.uint8)*255
    # keep glyphs only in overlay zones (status bar, logo, headline, pills, home bar)
    zones=np.zeros((H,W),np.uint8)
    cv2.rectangle(zones,(50,18),(112,48),255,-1)          # clock
    cv2.rectangle(zones,(262,20),(366,46),255,-1)         # status icons
    cv2.circle(zones,(197,316),60,255,-1)                  # logo
    cv2.rectangle(zones,(20,545),(320,745),255,-1)         # headline
    cv2.rectangle(zones,(20,755),(380,830),255,-1)         # pills
    cv2.rectangle(zones,(120,835),(280,860),255,-1)        # home indicator
    glyph=cv2.bitwise_and(glyph,zones)
    # Status icons sit on slow, dark silk: find them by local contrast instead.
    icons=np.zeros((H,W),np.uint8); cv2.rectangle(icons,(262,20),(366,46),255,-1)
    local=cv2.GaussianBlur(mean,(0,0),6)
    contrast=(mean<local-28) if m=='light' else (mean>local+28)
    glyph[icons>0]=0
    glyph[(icons>0)&contrast&(std<30)]=255
    glyph=cv2.dilate(glyph,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
    mask=glyph.copy()
    # dynamic island (solid pill)
    cv2.rectangle(mask,(147,18),(250,52),255,-1)
    # logo: whole disc (it moves a little)
    cv2.circle(mask,(197,316),44,255,-1)
    # pills: whole frosted capsules plus their soft edge
    for x0,x1 in [(28,198),(200,370)]:
        cv2.rectangle(mask,(x0,755),(x1,833),255,-1)
    mask=cv2.bitwise_or(mask,rounded_outside())
    cv2.imwrite(f'{S}/work/{m}_mask.png',mask)
    f0=np.asarray(Image.open(f'{S}/{m}/f0000.png').convert('RGB')).copy()
    over=f0.copy(); over[mask>0]=(0.4*over[mask>0]+0.6*np.array([255,0,0])).astype(np.uint8)
    Image.fromarray(over).save(f'{S}/work/{m}_maskpreview.png')
    print(m,'mask px',int((mask>0).sum()))

# ── 3. One clean loop, streak-directed fill ──────────────────────────────────
P=60
MAXD=170

def orientation(gray, known):
    # Blurred first, so the fine hatching doesn't steer the direction of the
    # big strands.
    g=cv2.GaussianBlur(gray.astype(np.float32),(0,0),1.5)
    gx=cv2.Sobel(g,cv2.CV_32F,1,0,ksize=5); gy=cv2.Sobel(g,cv2.CV_32F,0,1,ksize=5)
    w=known.astype(np.float32)
    J=[gx*gx*w, gx*gy*w, gy*gy*w]
    sig=16
    ws=cv2.GaussianBlur(w,(0,0),sig)+1e-6
    Jxx,Jxy,Jyy=[cv2.GaussianBlur(j,(0,0),sig)/ws for j in J]
    # a second, wider pass fills the inside of big holes
    ws2=cv2.GaussianBlur(w,(0,0),45)+1e-6
    J2=[cv2.GaussianBlur(j,(0,0),45)/ws2 for j in J]
    far=(cv2.GaussianBlur(w,(0,0),sig)<0.05)
    Jxx=np.where(far,J2[0],Jxx); Jxy=np.where(far,J2[1],Jxy); Jyy=np.where(far,J2[2],Jyy)
    # direction of least change (along the streaks): perpendicular to the dominant gradient
    theta=0.5*np.arctan2(2*Jxy, Jxx-Jyy)   # dominant gradient angle
    along=theta+np.pi/2
    return np.cos(along), np.sin(along)

def fill(img, mask, dx, dy):
    H,W=mask.shape
    hole=mask>0
    ys,xs=np.nonzero(hole)
    ux=dx[ys,xs]; uy=dy[ys,xs]
    known=~hole
    res=[]
    for sgn in (1,-1):
        found=np.zeros(len(ys),bool); dist=np.full(len(ys),np.inf,np.float32)
        px=np.zeros(len(ys),np.float32); py=np.zeros(len(ys),np.float32)
        for t in range(1,MAXD):
            x=xs+sgn*ux*t; y=ys+sgn*uy*t
            xi=np.clip(np.round(x).astype(int),0,W-1); yi=np.clip(np.round(y).astype(int),0,H-1)
            inside=(x>=0)&(x<=W-1)&(y>=0)&(y<=H-1)
            hit=inside&known[yi,xi]&~found
            dist[hit]=t; px[hit]=x[hit]; py[hit]=y[hit]; found|=hit
            if found.all(): break
        res.append((found,dist,px,py))
    out=img.astype(np.float32).copy()
    (f1,d1,x1,y1),(f2,d2,x2,y2)=res
    imgf=img.astype(np.float32)
    def sample(x,y):
        x=np.clip(x,0,W-1.001); y=np.clip(y,0,H-1.001)
        x0=np.floor(x).astype(int); y0=np.floor(y).astype(int); fx=(x-x0)[:,None]; fy=(y-y0)[:,None]
        a=imgf[y0,x0]; b=imgf[y0,x0+1]; c=imgf[y0+1,x0]; d=imgf[y0+1,x0+1]
        return (a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy
    c1=sample(x1,y1); c2=sample(x2,y2)
    both=f1&f2
    v=np.zeros((len(ys),3),np.float32)
    w1=(d2/(d1+d2))[:,None]
    v[both]=(c1*w1+c2*(1-w1))[both]
    only1=f1&~f2; only2=f2&~f1
    v[only1]=c1[only1]; v[only2]=c2[only2]
    none=~(f1|f2)
    out[ys,xs]=v
    # anything no walk reached (rare): classic inpainting
    if none.any():
        m2=np.zeros_like(mask); m2[ys[none],xs[none]]=255
        out=cv2.inpaint(np.clip(out,0,255).astype(np.uint8),m2,5,cv2.INPAINT_TELEA).astype(np.float32)
    # soften the fill a touch along the seam
    soft=cv2.GaussianBlur(out,(0,0),1.2)
    seam=cv2.GaussianBlur((mask>0).astype(np.float32),(0,0),1.5)[...,None]
    out=out*(1-seam*0.6)+soft*(seam*0.6)
    return np.clip(out+0.5,0,255).astype(np.uint8)

for m in ['light','dark']:
    fs=sorted(glob.glob(f'{S}/{m}/f*.png'))
    frames=np.stack([cv2.imread(f).astype(np.float32) for f in fs])
    mask=cv2.imread(f'{S}/work/{m}_mask.png',0)
    avgs=[np.clip(frames[list(range(k,len(frames),P))].mean(0)+0.5,0,255).astype(np.uint8) for k in range(P)]
    mean=np.mean(avgs,0).astype(np.uint8)
    # The glow around overlays (button rims, text halos) must not steer the
    # direction: leave a margin around every hole out of the estimate.
    margin=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(25,25)))
    dx,dy=orientation(cv2.cvtColor(mean,cv2.COLOR_BGR2GRAY),margin==0)
    os.makedirs(f'{S}/clean_{m}',exist_ok=True)
    for k,a in enumerate(avgs):
        cv2.imwrite(f'{S}/clean_{m}/c{k:03d}.png',fill(a,mask,dx,dy))
    print(m,'done')

# ── 4. Flatten faint halos, crop ─────────────────────────────────────────────
def ss(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
for m in ['light','dark']:
    mask=cv2.imread(f'{S}/work/{m}_mask.png',0)
    zone=cv2.GaussianBlur(cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(31,31))).astype(np.float32)/255,(0,0),4)[...,None]
    os.makedirs(f'{S}/final_{m}',exist_ok=True)
    for f in sorted(glob.glob(f'{S}/clean_{m}/c*.png')):
        im=cv2.imread(f).astype(np.float32)
        if m=='light':
            d=(255-im.min(2))[...,None]           # how far from white
            k=ss(4,14,d)                           # keep real colour, flatten faint grey
            flat=255-(255-im)*k
        else:
            d=im.max(2)[...,None]
            k=ss(4,16,d)
            flat=im*k
        out=im*(1-zone)+flat*zone
        out=np.clip(out+0.5,0,255).astype(np.uint8)[10:856,4:394]
        cv2.imwrite(f'{S}/final_{m}/'+os.path.basename(f),out)
    print(m, out.shape)
