# 한국인 피부 분석 기반 맞춤형 화장품 추천 시스템

사용자의 셀카 이미지와 폼 입력을 받아, 한국인 피부 데이터로 학습한 CNN으로 피부 속성을 추정하고 식약처 공공 데이터 기반으로 맞춤 화장품·성분을 추천하는 시스템.

> **주의**: 이 시스템은 화장품 추천 보조 도구입니다. 의료 진단이 아닙니다.

## 데이터 출처

- **AI Hub 한국인 피부상태 측정 데이터**: 비상업 연구·교육 목적으로 사용
  - https://www.aihub.or.kr/aihubdata/data/view.do?dataSetSn=71645
  - 데이터는 재배포 금지 → `data/` 폴더는 `.gitignore` 처리
- **식약처 공공데이터**: 공공데이터포털 Open API

## 폴더 구조

```
skin-project/
├── data/                  # .gitignore (재배포 금지)
│   ├── raw/aihub/         # AI Hub 원본
│   ├── raw/mfds/          # 식약처 API 응답
│   └── processed/
├── notebooks/             # EDA 주피터 노트북
├── src/
│   ├── data/              # 데이터 로더
│   ├── models/            # CNN 모델
│   ├── train/             # 학습/평가
│   ├── recommend/         # 추천 모듈
│   ├── form/              # 입력 폼 스키마
│   └── utils/
├── configs/               # 하이퍼파라미터
├── app/                   # Streamlit 데모
└── reports/               # 보고서, 발표자료
```

## 설치

```bash
python -m venv venv
# Windows
venv\Scripts\activate
pip install -r requirements.txt
```

## 시스템 아키텍처

```
[이미지 셀카] + [폼 입력]
       ↓
Module 1: CNN 피부 속성 추정 (EfficientNet-B0, Multi-task)
       ↓
Module 2: 성분 매칭 (속성 → 권장/회피 성분)
       ↓
Module 3: 제품 추천 (TF-IDF + 후처리 필터)
       ↓
Module 4: 설명 생성 (룰베이스 템플릿)
       ↓
[피부 속성 리포트 + 추천 성분 + 추천 제품]
```
