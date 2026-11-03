"""Cut a product photo out of its white background (PNG/WebP with alpha).
Only near-white pixels connected to the image border are removed, so highlights inside the product stay.
Usage: python3 scripts/cutout.py in.webp out.webp"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

def cutout(img, threshold=232, feather=1.2):
    rgb = np.asarray(img.convert('RGB')).astype(np.int16)
    light = rgb.min(axis=2) >= threshold                     # near-white
    labels, _ = ndimage.label(light)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    bg = np.isin(labels, list(border))
    bg = ndimage.binary_opening(bg, iterations=1)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # Soft edge: fade pixels next to the background by how white they are.
    edge = ndimage.binary_dilation(bg, iterations=2) & ~bg
    whiteness = (rgb.min(axis=2) - 180).clip(0, 75) / 75.0
    alpha[edge] = (255 * (1 - 0.85 * whiteness[edge])).astype(np.uint8)
    a = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(feather))
    out = img.convert('RGBA'); out.putalpha(a)
    return out.crop(out.getbbox())

if __name__ == '__main__':
    cutout(Image.open(sys.argv[1])).save(sys.argv[2], quality=92, method=6)
