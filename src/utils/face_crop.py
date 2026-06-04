"""
OpenCV Haar Cascade 기반 얼굴 부위 크롭 유틸리티.

[설계 이유]
  CNN에 얼굴 전체 이미지를 주면 관련 없는 배경·머리카락이 섞여 학습 효율이 떨어진다.
  속성별로 실제로 보이는 부위(이마→주름, 볼→모공)만 잘라서 넘겨주면
  모델이 해당 영역에 집중할 수 있다.

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

# ─── 부위 → 타겟 매핑 ─────────────────────────────────────────────────────
# 각 얼굴 부위 크롭이 어떤 속성 예측에 사용되는지 정의한다.
# 추론 시 이 dict를 순회하며 부위별로 해당 head에만 예측을 넘긴다.
FACEPART_TARGETS: dict[str, list[str]] = {
    "forehead":   ["forehead_wrinkle", "forehead_pigmentation"],
    "periocular": ["l_perocular_wrinkle"],
    "cheek":      ["l_cheek_pore", "l_cheek_pigmentation"],
    "lips":       ["lip_dryness"],
    "chin":       ["chin_sagging"],
}

# ─── 얼굴 내 부위 좌표 (비율) ─────────────────────────────────────────────
# (y_top, y_bot, x_left, x_right) — 얼굴 bbox 대비 상대 비율.
# AI Hub 학습 데이터의 촬영 각도·구도를 분석해서 결정한 값이다.
# 왼쪽(x < 0.5)만 사용하는 이유:
#   - AI Hub 라벨이 l_(left) 기준으로 어노테이션됨
#   - TTA에서 flip을 제외하기 때문에 방향 일관성 유지가 필요함
_PART_BOXES: dict[str, tuple[float, float, float, float]] = {
    "forehead":   (0.02, 0.32, 0.10, 0.90),
    "periocular": (0.28, 0.52, 0.05, 0.50),   # 카메라 기준 왼쪽 눈
    "cheek":      (0.46, 0.72, 0.03, 0.48),   # 카메라 기준 왼쪽 볼
    "lips":       (0.63, 0.83, 0.25, 0.75),
    "chin":       (0.76, 1.00, 0.20, 0.80),
}

# OpenCV 내장 정면 얼굴 검출기 (Haar Cascade).
# 딥러닝 기반 검출기보다 빠르고 추가 의존성이 없어서 선택했다.
_CASCADE_PATH = (
    Path(cv2.__file__).parent / "data" / "haarcascade_frontalface_default.xml"
)
_cascade = cv2.CascadeClassifier(str(_CASCADE_PATH))


def _detect_face(img_bgr: np.ndarray) -> tuple[int, int, int, int] | None:
    """
    이미지에서 가장 큰 얼굴의 bbox (x, y, w, h) 반환. 미검출 시 None.

    [왜 가장 큰 얼굴?]
    사진에 여러 얼굴이 있을 때 배경 인물이 아닌 주 피사체(가장 크게 찍힌)를 선택하기 위해.

    [detectMultiScale 파라미터 설명]
    scaleFactor=1.1  : 이미지를 단계적으로 축소하는 비율. 작을수록 정밀하지만 느림.
    minNeighbors=5   : 후보 영역을 몇 번 이상 검출해야 얼굴로 인정할지. 클수록 오검출 감소.
    minSize=(80,80)  : 이 크기보다 작은 얼굴은 무시. 너무 작은 얼굴은 특징 추출이 어려움.
    """
    gray  = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    faces = _cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(80, 80),
    )
    if len(faces) == 0:
        return None
    # 가장 큰 얼굴(w*h 최대)을 선택
    return max(faces, key=lambda f: f[2] * f[3])


def crop_faceparts(
    image: Image.Image,
    return_detection: bool = False,
) -> dict[str, Image.Image] | tuple[dict[str, Image.Image], bool]:
    """
    이미지 → 5개 부위별 크롭 dict 반환.

    [전체 흐름]
    1. PIL 이미지 → OpenCV BGR 배열 변환
    2. 얼굴 bbox 검출
    3. 검출 성공 → 비율 좌표로 5개 부위 크롭
       검출 실패 → 원본 이미지 그대로 fallback (서비스 중단 방지)

    Parameters
    ----------
    image            : 입력 이미지 (PIL.Image)
    return_detection : True면 (crops, face_detected) 튜플 반환.
                       False(기본값)면 crops dict만 반환.
    """
    # 얼굴 검출 실패 시 원본 이미지를 모든 부위에 사용 (fallback)
    # → 서비스가 얼굴 미검출로 멈추지 않도록 안전장치
    fallback = {k: image for k in FACEPART_TARGETS}

    # PIL(RGB) → numpy → OpenCV(BGR) 변환 (OpenCV는 BGR 순서를 사용)
    img_bgr = cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)
    face = _detect_face(img_bgr)

    if face is None:
        # 얼굴 미검출: 원본 이미지 전체를 각 부위 크롭으로 사용
        return (fallback, False) if return_detection else fallback

    fx, fy, fw, fh = face   # 검출된 얼굴의 x, y, width, height
    W, H = image.size        # 원본 이미지 전체 크기

    crops: dict[str, Image.Image] = {}
    for part, (yt, yb, xl, xr) in _PART_BOXES.items():
        # 얼굴 bbox 기준 상대 비율 → 실제 픽셀 좌표로 변환
        # max(0, ...), min(W, ...) 로 이미지 경계 밖으로 나가지 않도록 clamp
        x1 = max(0, int(fx + xl * fw))
        y1 = max(0, int(fy + yt * fh))
        x2 = min(W, int(fx + xr * fw))
        y2 = min(H, int(fy + yb * fh))

        if x2 > x1 and y2 > y1:
            # 정상 크롭: 계산된 좌표로 자르기
            crops[part] = image.crop((x1, y1, x2, y2))
        else:
            # 비정상 좌표(크기 0 이하): 원본으로 fallback
            crops[part] = image

    return (crops, True) if return_detection else crops
