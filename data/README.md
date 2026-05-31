# 데이터 디렉토리

## 주의사항

- AI Hub 데이터는 비상업 연구·교육 목적으로만 사용
- **재배포 금지** — 이 폴더는 .gitignore 처리됨 (GitHub에 push 금지)
- 학습된 모델 가중치만 공유 가능

## 데이터 출처

| 폴더 | 데이터 | 출처 |
|---|---|---|
| raw/aihub/ | 한국인 피부상태 측정 데이터 | AI Hub (승인 완료) |
| raw/mfds/ | 화장품 원료성분·사용제한·기능성 제품 | 식약처 Open API |

## AI Hub 다운로드 순서

1. `Other.zip` (171KB) — 메타정보/README
2. `TL.zip` (47MB) — Training 라벨
3. `VL.zip` (6MB) — Validation 라벨
4. `VS.zip` (2GB) — Validation 이미지
5. `TS.zip` (19GB) — Training 이미지 (마지막)
