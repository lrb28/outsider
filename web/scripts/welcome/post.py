# 4× upscaled frames -> 1170×2538, cyclic temporal [1,2,1] smoothing, poster.
import sys, glob, os
import numpy as np
from PIL import Image
W, H = 1170, 2538
src, dst, poster = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(dst, exist_ok=True)
fs = sorted(glob.glob(f"{src}/c*.png"))
fr = [np.asarray(Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS), dtype=np.float32) for f in fs]
n = len(fr)
for k in range(n):
    v = 0.25 * fr[(k - 1) % n] + 0.5 * fr[k] + 0.25 * fr[(k + 1) % n]
    Image.fromarray(np.clip(v + 0.5, 0, 255).astype(np.uint8)).save(f"{dst}/c{k:03d}.png")
Image.open(f"{dst}/c000.png").save(poster, quality=86, optimize=True, progressive=True)
print("frames", n, "->", dst)
