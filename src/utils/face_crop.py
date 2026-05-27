"""
OpenCV Haar Cascade 기반 얼굴 부위 크롭 유틸리티.

얼굴 bounding box를 검출한 뒤 해부학적 비율로 5개 부위를 분할한다.
검출 실패 시 원본 이미지로 fallback.

부위 → 타겟 매핑:
  forehead   → forehead_wrinkle, forehead_pigmentation
  periocular → l_perocular_wrinkle
  cheek      → l_cheek_pore, l_cheek_pigmentation  (카메라 기준 왼쪽)
  lips       → lip_dryness
  chin       → chin_sagging

얼굴 높이 비율 기준 (0.0=검출된 얼굴 상단, 1.0=하단):
  이마:  0.02 ~ 0.32   (눈썹 위까지)
  눈가:  0.30 ~ 0.52   (눈썹 ~ 눈꺼풀 아래)
  볼:    0.48 ~ 0.72   (눈 아래 ~ 입꼬리)
  입술:  0.65 ~ 0.82
  턱:    0.78 ~ 1.00
"""

import cv2
import numpy as np
from pathlib import Path
from PIL import Image

# 부위 → 해당 multi-task 타겟
FACEPART_TARGETS: dict[str, list[str]] = {
    "forehead":   ["forehead_wrinkle", "forehead_pigmentation"],
    "periocular": ["l_perocular_wrinkle"],
    "cheek":      ["l_cheek_pore", "l_cheek_pigmentation"],
    "lips":       ["lip_dryness"],
    "chin":       ["chin_sagging"],
}

# 각 부위의 얼굴 내 상대 좌표 (y_top, y_bot, x_left, x_right) – 비율 기준
# x 0.0=얼굴 왼쪽, 1.0=얼굴 오른쪽 / y 0.0=얼굴 상단, 1.0=얼굴 하단
_PART_BOXES: dict[str, tuple[float, float, float, float]] = {
    "forehead":   (0.02, 0.32, 0.10, 0.90),
    "periocular": (0.28, 0.52, 0.05, 0.50),   # 카메라 기준 왼쪽 눈
    "cheek":      (0.46, 0.72, 0.03, 0.48),   # 카메라 기준 왼쪽 볼
    "lips":       (0.63, 0.83, 0.25, 0.75),
    "chin":       (0.76, 1.00, 0.20, 0.80),
}

_CASCADE_PATH = (
    Path(cv2.__file__).parent / "data" / "haarcascade_frontalface_default.xml"
)
_cascade = cv2.CascadeClassifier(str(_CASCADE_PATH))


def _detect_face(img_bgr: np.ndarray) -> tuple[int, int, int, int] | None:
    """가장 큰 얼굴의 (x, y, w, h) 반환. 미검출 시 None."""
    gray  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = _cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(80, 80),
    )
    if len(faces) == 0:
        return None
    # 가장 큰 얼굴 선택
    return max(faces, key=lambda f: f[2] * f[3])


def crop_faceparts(
    image: Image.Image,
    return_detection: bool = False,
) -> dict[str, Image.Image] | tuple[dict[str, Image.Image], bool]:
    """
    이미지 → 5개 부위별 크롭 dict 반환.

    Parameters
    ----------
    image            : 입력 이미지
    return_detection : True이면 (crops, face_detected) 튜플 반환.
                       False(기본값)이면 crops dict만 반환 — 기존 API와 호환.

    Returns
    -------
    crops        : 부위명 → 크롭 이미지 dict
    face_detected: 얼굴 검출 성공 여부 (return_detection=True일 때만)
    """
    fallback = {k: image for k in FACEPART_TARGETS}

    img_bgr = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    face = _detect_face(img_bgr)

    if face is None:
        return (fallback, False) if return_detection else fallback

    fx, fy, fw, fh = face
    W, H = image.size

    crops: dict[str, Image.Image] = {}
    for part, (yt, yb, xl, xr) in _PART_BOXES.items():
        x1 = max(0, int(fx + xl * fw))
        y1 = max(0, int(fy + yt * fh))
        x2 = min(W, int(fx + xr * fw))
        y2 = min(H, int(fy + yb * fh))

        if x2 > x1 and y2 > y1:
            crops[part] = image.crop((x1, y1, x2, y2))
        else:
            crops[part] = image

    return (crops, True) if return_detection else crops
