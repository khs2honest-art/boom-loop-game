# BOOM LOOP 출시 판단표 — 2026-10-26

## 완료 / 기술적으로 확인됨
- Cloudflare Workers + D1 백엔드 및 모바일 HTML 프런트.
- 24시간 링크 릴레이, 가상 포인트와 확률, 1인 1개 활성 폭탄, 보상 중복 차단.
- 만료 후 비식별 공개 결과 카드 + 재공유.
- 초대 열람→수락률→재전달률 퍼널 기록; 가상 테스트 데이터는 실사용자 지표가 아님.
- 개인정보·게임 규칙 안내 HTML, 브라우저 세션 쿠키 1년.
- 24시간 게임 종료 후 30일 지난 기록 자동 정리, 90일 지난 참조 없는 사용자 정리.
- Cloudflare local Workers+D1 HTTP 통합테스트, 실제 Chrome 모바일 320·390px E2E, 정리 Cron 실제 동작 검사 완료.
- Request body 512 bytes 상한, anti-framing CSP/Permissions-Policy, JSON·Origin 검증.
- 테스트마다 독립 로컬 D1 저장소를 사용하여 반복 오염 차단.

## 공개 전 차단 요건
1. **정식 배포 서버 미확보:** 무료 정식 Cloudflare 인증/계정 없음. 별도의 Cloudflare Quick Tunnel(계정 없이 임시 HTTPS 터널)은 2026-10-26 20:52 및 20:56 KST에 인터넷 실동작 테스트를 통과했지만, 테스트 후 종료하여 현재 접근 가능한 링크는 없음. 무료 Quick Tunnel은 PC 상주·매번 URL 변경·가용성 미보장으로 상용 서비스로 부적합. 이전 Workers 임시 배포 CLI는 Windows 런타임 종료됨.
2. **이용자 및 매출:** 실제 고객 0명(측정한 데이터 전부 자체 테스트), 광고 승인 0, 광고 수익 0원.
3. **운영 주체:** 개인정보 문의·삭제 요청 및 사업자 고지 채널 미준비. privacy.html은 현 상태 한계를 명시한 개발용 안내.
4. **법률:** 한국 게임산업법의 등급분류/예외 여부는 개별 확인 필요. 비영리 시험이나 개인 단순 공개 예외가 상업 광고 게임에 자동 적용된다고 볼 수 없음.
5. **광고:** Google AdSense는 광고 클릭/노출 조작, 이용자에게 비보상형 광고를 시청하도록 보상/유도하는 행위 금지. 현재 포인트는 광고와 분리, 광고 미삽입.
6. **실사용자 검증:** 개인정보 보호/쿠키 동작을 포함해 실제 휴대폰 2~3대와 친구들의 재공유 의사를 확인해야 함. 현재 검증은 Chrome의 모바일 에뮬레이션.
7. **부정 참여 위험:** 익명 쿠키만으로 여러 브라우저/기기의 동일 사용자까지 판별할 수 없음. 현금 교환/상금 제도는 도입 불가.

## 근거
- Cloudflare Workers Free limits (2026-10-12): https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1 Free FAQ: https://developers.cloudflare.com/d1/reference/faq/
- Google AdSense policies: https://support.google.com/adsense/answer/48182
- 생활법령 온라인 게임 등급분류 및 예외: https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=1&cciNo=1&cnpClsNo=1&csmSeq=2858&popMenu=ov

## 다음 개발 우선순위
- 실제 사용자 없이도 검증 가능한 모바일 시각 QA, 크래시/성능, 동시성, 테스트 자동화 보강.
- 서버 확보 전에는 광고를 넣지 않음. 수익/배포 가능하다고 과장하지 않음.
- 계정 인증이나 은행 계좌는 사용자 원칙상 요청하지 않음. 지급할 실제 수익이 확정됐을 때만 계좌 문의.

## 2026-10-26 신규 검증: 계정 없는 임시 외부 공개 성공
- Wrangler tunnel quick-start 명령으로 무료 Cloudflare trycloudflare.com HTTPS 임시 주소 생성 성공. 기존 실패한 Workers 임시 배포와 별도 경로.
- 온라인 브라우저/서버: URL 발급, 사이트 접속, API·세션 DB 연결, 서버 생성, HTTPS 초대 링크, Chrome A→B 수락, A 보상/B 5점, 보안 쿠키 Secure 속성, 임시 주소 noindex, JS 예외 0.
- 외부 프록시가 로컬에서 HTTP로 전달하여 초대 링크를 http://로 잘못 생성하던 문제를 publicOrigin()으로 수정·검증.
- 테스트 뒤 터널·로컬 서버 모두 종료. 포트18893 미수신 확인. URL은 로그에 남아도 이제 접근되지 않음.
- test_external_tunnel.bat에서 반복 재현 가능. test_preview_shutdown.bat로 서버 종료 확인 가능. 개인 계정 인증 불필요.
- 실사용자나 상시 수익화 목적이 아닌 개발/시연용 임시 터널임. 200 동시 요청 제한/가용성 보장 없음/주소 변동(https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## 2026-10-26 21:35 업데이트
- 개인정보 처리 방침 내 '게임 계정 기록 삭제 기능 없음'은 이제 해당하지 않음. 웹앱 '내 익명 게임 기록 삭제' 버튼과 /api/erase를 구현했음.
- 점수·테마·브라우저 세션을 삭제하고 전달 내역에 있는 사용자의 참조 ID를 무작위 익명 ID로 치환한다. 현재 보유 폭탄은 종료, 과거 전달 통계는 유지.
- 이 자가 삭제 기능은 로컬 통합·Chrome 모바일·Cloudflare 임시 공개 HTTPS 실동작 검사 PASS.
- **여전히 정식 개인정보 처리자 문의 채널, 외부 호스팅 접속로그 삭제·열람 절차, 한국 법령 기준 검토는 미완료.**
- 연결된 GitHub는 새 저장소를 만드는 기능을 제공하지 않음. 기존 비관련 저장소를 건드리지 않았음. CLI Cloudflare 로그인도 없음.
