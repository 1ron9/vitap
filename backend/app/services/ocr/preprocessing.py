"""M2. Image Processing Module (Resize, Denoise, Threshold, Deskew)."""

from pathlib import Path
from typing import Union
import io
import numpy as np
from PIL import Image, ImageFilter, ImageOps

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False


def load_image(source: Union[str, Path, Image.Image, np.ndarray, bytes]) -> Image.Image:
    """Load an image from path, PIL Image, numpy array, or bytes into RGB PIL Image."""
    if isinstance(source, bytes):
        return Image.open(io.BytesIO(source)).convert("RGB")
    if isinstance(source, (str, Path)):
        path = Path(source)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        return Image.open(path).convert("RGB")
    if isinstance(source, Image.Image):
        return source.convert("RGB")
    if isinstance(source, np.ndarray):
        return Image.fromarray(source).convert("RGB")
    raise TypeError(f"Unsupported image source type: {type(source)}")


def resize_image(img: Image.Image, max_side: int = 1600) -> Image.Image:
    """Resize image preserving aspect ratio if its longest side exceeds max_side."""
    w, h = img.size
    longest = max(w, h)
    if longest <= max_side:
        return img
    scale = max_side / float(longest)
    new_size = (int(w * scale), int(h * scale))
    return img.resize(new_size, Image.Resampling.LANCZOS)


def deskew_image(img: Image.Image) -> Image.Image:
    """Estimate skew angle and rotate to align horizontal text lines."""
    if not HAS_CV2:
        return img

    gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
    inv = cv2.bitwise_not(gray)
    thresh = cv2.threshold(inv, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if coords.size == 0:
        return img

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.5 or abs(angle) > 15.0:
        return img

    h, w = gray.shape[:2]
    center = (w // 2, h // 2)
    mat = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        np.array(img), mat, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    return Image.fromarray(rotated)


def enhance_and_denoise(img: Image.Image, binarize: bool = False) -> Image.Image:
    """Apply denoising, contrast normalization, and optional adaptive thresholding."""
    if HAS_CV2:
        arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)
        denoised = cv2.fastNlMeansDenoising(arr, None, h=10, templateWindowSize=7, searchWindowSize=21)
        if binarize:
             binary = cv2.adaptiveThreshold(
                 denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8
             )
             return Image.fromarray(binary).convert("RGB")
        return Image.fromarray(denoised).convert("RGB")

    # Fallback using PIL + numpy when OpenCV is not installed
    gray = ImageOps.grayscale(img)
    autocontrast = ImageOps.autocontrast(gray, cutoff=1)
    filtered = autocontrast.filter(ImageFilter.MedianFilter(size=3))
    if binarize:
        arr = np.array(filtered)
        threshold = int(np.mean(arr) * 0.85)
        binary = np.where(arr > threshold, 255, 0).astype(np.uint8)
        return Image.fromarray(binary).convert("RGB")
    return filtered.convert("RGB")


def preprocess_image(
    source: Union[str, Path, Image.Image, np.ndarray],
    max_side: int = 1600,
    deskew: bool = True,
    binarize: bool = False,
) -> Image.Image:
    """Run M2 preprocessing pipeline: load -> resize -> deskew -> denoise/enhance."""
    img = load_image(source)
    img = resize_image(img, max_side=max_side)
    if deskew:
        img = deskew_image(img)
    img = enhance_and_denoise(img, binarize=binarize)
    return img
