# 새김 (Saegim) — 교회 관리 SaaS

## 프로젝트 개요

교회 사무장/사역자 전용 내부 관리자 웹앱. 교인이 직접 사용하지 않음.
단일 교회용에서 **여러 교회가 가입해 독립적으로 사용하는 SaaS**로 전환 중.

## 스택

- **Frontend**: React 18 + Vite + React Router v6 → Vercel 배포
- **Backend**: Node.js + Express ESM → Railway 배포
- **DB**: PostgreSQL (Railway)
- **인증**: Google OAuth + JWT
- **파일 업로드**: Multer
- **SMS**: 알리고 or 솔라피 (미확정)

## 현재 도메인

`church.rudilick.com` → 변경 예정 (새 도메인 미확정)

## SaaS 전환 — 확정된 결정사항

| 항목 | 결정 |
|------|------|
| 멀티테넌시 방식 | 단일 PostgreSQL DB + `church_id` 컬럼 Row-Level 분리 |
| 서비스명 | **새김** |
| 실행 순서 | ① 도메인 변경 먼저 → ② 멀티테넌시 전환 (별도 브랜치) |
| 기존 데이터 | `church_id=1`로 보존 |
| 보안 핵심 원칙 | `church_id`는 프론트가 아닌 `req.user.church_id`에서만 결정 |
| Repository 패턴 | 스킵 (과설계). 미들웨어 주입 방식으로 단순하게 |
| Role 구조 | 현행 유지: `super_admin / church_admin / pastor / teacher / finance / member` |
| Audit log | 2단계 MVP 이후 추가 |
| 입력값 검증 | Zod 사용 (backend) |
| PostgreSQL RLS | 당장 아님. 구조만 열어둠 (모든 테이블에 church_id 인덱스) |

## 멀티테넌시 전환 단계 요약

- **Phase 1** — DB 스키마: `churches` 테이블 신규 생성 + 16개 테이블에 `church_id` 컬럼 추가 + 복합 인덱스
- **Phase 2** — 미들웨어: `requireChurchAccess` 추가, body의 `church_id` strip
- **Phase 3** — 라우트 전수 수정 (26개): 모든 쿼리에 `WHERE church_id = $n` 강제
- **Phase 4** — 교회 등록/가입 플로우: `/register-church` 페이지 + `POST /api/churches`
- **Phase 5** — 도메인 변경 (Phase 1~4와 독립적, 먼저 실행)

> 상세 플랜: `.claude/plans/mellow-wondering-brook.md` (로컬 전용)

## 현재 준비 상태 (코드에 이미 있는 것)

- `users.church_id` 컬럼 (DEFAULT 1)
- JWT 페이로드에 `church_id` 포함
- `requireAuth`, `requireRole` 미들웨어
- `super_admin / church_admin` 역할 정의

## 반응형 기준

- 태블릿: 767px 기준
- 폰: 별도 처리
