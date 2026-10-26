# BOOM LOOP — 운영 공개 패키지 가이드

작성일: 2026-10-26. 무료 운영·개발 완료 상태와 **정식 출시 가능 상태는 다릅니다**.

## 패키지 구성
- Cloudflare Workers 서버(worker.js), 익명 릴레이·비현금 포인트.
- D1 SQL schema.sql / migration_002_lifetime.sql.
- 웹 정적 파일 public/index.html, public/app.js, public/privacy.html, public/rules.html.
- retention.js 만료·삭제 예약작업.
- wrangler.toml 환경설정 템플릿, package.json / package-lock.json 의존성 고정. 의존성 설치는 npm ci.
- README.md, RELEASE_GATES.md, FREE_TIER_AND_GROWTH.md.

## 배포 전 반드시 해결해야 하는 요건
1. 운영자 소유의 Cloudflare 계정에 정상 로그인 및 Workers/D1를 장기 이용할 수 있는지 확인. 현재 로컬 Wrangler 로그인은 없음.
2. 개인정보 보호책임자/이용자 문의·삭제 접수 채널 완성, 운영자 법정 고지사항 채우기.
3. 국내 게임 등급분류 또는 적용 예외 여부 확인. 무상·비현금 포인트 게임이라는 이유만으로 자동 면제되지 않음.
4. 앱의 정식 운영 약관/광고 서비스 승인 및 광고 데이터 처리 고지 점검.
5. 실제 휴대폰·여러 브라우저·적합한 소규모 정상 이용자 테스트와 CPU/DB 무료 한도 모니터링.

## 운영 계정이 준비된 다음에만 실행할 내용
- Cloudflare D1 DB를 별도로 생성하고 반환된 UUID를 wrangler.toml의 REPLACE_WITH_D1_DATABASE_ID 대신 입력.
- 서버 배포 전 필요한 SQL D1 migration 실행. 데이터가 있는 경우 별도 백업과 검증 먼저.
- 무료 한도, 공개 URL/도메인, Worker 장애·로그 확인.
- 실제 광고 배너는 승인받은 뒤 게임 참여/점수와 연계하지 않고 별도 적용.

## 보안 주의
- 이 패키지에는 Cloudflare API 키, 개인 비밀번호, 계정 토큰, 사용자 실제 DB, 브라우저 쿠키가 포함되지 않음.
- 배포 템플릿에 D1 ID가 비어 있으므로 바로 작동하는 정식 공개 패키지는 아님.
- 테스트와 임시 Cloudflare Quick Tunnel 공개 성공은 정식 서비스 출시가 아님.
- 기존 개인 사이트와 저장소는 변경하지 않음.

## 개인정보와 배포 검증 추가 (2026-10-26)
- 테스트용 개인정보 삭제: POST /api/erase. 원래 브라우저의 게임 점수·테마·세션 연결을 제거하며 전송 통계에는 새 비연결 익명 식별자만 남긴다.
- Cloudflare 배포 번들 로컬 빌드 검사 test_deployment_build.bat 통과. 이 검사는 원격 앱 등록/광고 승인/개인정보 처리책임자 고지를 완료하는 작업이 아님.
- 실제 출시 전 게임물 등급·개인정보 책임자 정보·광고 심사·정산 자격 확보 필요.
