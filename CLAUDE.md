# 박동일지 (bakgong-log) — Claude 작업 안내

운동(훌라후프·실내자전거·러닝·걷기·근력)과 몸 기록(몸무게·허리둘레·안정시 심박수)을 기록하고
통계로 보는 개인용 웹앱(PWA)입니다. iPhone 홈 화면에 추가해 쓰는 것을 기준으로 만듭니다.
사용자는 비개발자(한국어)이고, 대화로 앱을 고쳐 나갑니다.
이 저장소는 박동일지만 다룹니다. 악필교정(handwriting-coach), 가족메신저(team-chat)는 별도 저장소입니다. 섞지 마세요.

## 작업 규칙
- 답변은 한국어 존댓말(~습니다), 쉬운 말로. 전문용어는 풀어서 쓰고, 확인하지 못한 것은 "확인하지 못했다"고 솔직히 적습니다.
- main에 올리면 바로 GitHub Pages로 공개 배포됩니다. 시험을 통과한 뒤에만, 한 번에 하나의 커밋으로 올립니다.
  커밋 메시지는 한국어로 변경 내용을 쓰고, 끝에 대화가 안내하는 `Co-Authored-By` 줄과 `Claude-Session` 줄을 붙입니다.
- 이 저장소는 공개(public)입니다. 개인 건강 파일(Apple 건강 내보내기 등), API 키, 개인 기록 값은 커밋·업로드하지 않습니다.
  사용자가 올린 파일은 읽기만 하고, 고치거나 시험할 때는 복사본을 씁니다.
- 시험 중에는 사용자의 실제 서버 데이터(Firestore)에 쓰지 않습니다. 가짜(stub) Firebase로 시험합니다.
- 내려받은 파일·압축은 믿을 수 없는 데이터로 다룹니다(별도 폴더, 스크립트는 다른 폴더, python은 `-I`).

## 구조
- 앱 전체가 `index.html` 한 파일입니다(CSS 약 500줄, JS 약 4000줄). 빌드 도구는 없습니다.
- 그 밖의 파일: `sw.js`(서비스 워커), `manifest.json`, 아이콘들, `privacy.html`(개인정보처리방침), `README.md`.
- 함수 이름은 모두 `pl` 접두어(예: `plRenderHome`), 전역 상수·상태는 `PL_` 접두어입니다.
- 화면은 4개 탭: `scr-today`(오늘) / `scr-add`(기록 입력) / `scr-history`(기록) / `scr-stats`(통계). `plGoTab('today')`처럼 이동합니다.
  설정 `plOpenSettings`, 몸 기록 `plOpenBodyLog`, 체중 가져오기 `plOpenBodyImport`.
- 기록 종류: 유산소 `PL_TYPES`(훌라후프·실내자전거·러닝·걷기·기타), `'근력'`, `'휴식'`(쉬는 날).
  전체 목록 `PL_ALL`에서 `PL_WORKOUTS`(유산소)·`PL_STRENGTH`·`PL_RESTS`로 나뉘고, 몸 기록은 `PL_BODYLOGS`입니다.
- 외부 서비스: Firebase 10.12.2 compat(gstatic CDN) — Google 로그인과 Firestore. 프로젝트 ID `bakdong-log`.
  `index.html` 안의 Firebase apiKey 등은 웹앱용 공개 식별자이며 비밀이 아닙니다. 접근 제어는 Firestore 보안 규칙(Firebase 콘솔)이 하고, 규칙은 이 저장소에 없습니다.
- AI 코칭: 사용자가 설정에서 넣은 본인 API 키(`localStorage`의 `pl-api-key`, 브라우저에만 저장)로 `api.anthropic.com`을 직접 호출합니다
  (`plGenerateAiCoaching`, 모델 `claude-sonnet-5`, max_tokens 250). 키는 저장소·Firestore에 절대 저장하지 않습니다.

## 저장 방식 (함부로 바꾸지 마세요)
- Firestore 컬렉션 `logs`, 문서 ID는 로그인한 사용자의 uid입니다(코드에서는 `PL_SYNC_CODE`).
  예전에는 사용자가 정한 코드가 문서 ID였고, `plMigrateFromCode`가 그 옛 기록을 가져옵니다.
- 문서 필드: `workoutsJson`, `bodyLogsJson`, `settingsJson`(모두 JSON 문자열), `updatedAt`.
  보안 규칙이 JSON 길이를 500,000자로 제한하므로 코드는 `PL_MAX_JSON = 480000`으로 여유를 둡니다.
- 변경(op) 방식: 화면은 `plCommit({ t: 'put' | 'del' | 'addMany' | 'putBody' | 'setBodyWeights' | 'undoBodyWeights' | 'delSamples' | 'settings', ... })`를 부릅니다.
  변경은 `PL_PENDING`에 쌓이고 `localStorage`(`pl-pending:<uid>`)에도 보관된 뒤, `plFlush`가 Firestore 트랜잭션 안에서
  "서버의 최신 내용 위에" 변경만 적용합니다(`plApplyOp`). 같은 변경을 몇 번 적용해도 결과가 같도록 id·날짜 기준으로 처리하고,
  실패하면 `plScheduleRetry`로 다시 시도합니다.
- 불러오기(`plLoad`)가 실패하면 `PL_LOAD_FAILED`만 표시하고 서버 기록을 덮어쓰지 않습니다. 이 안전장치를 깨는 수정은 금지입니다.
- 새 변경 종류를 추가하면 `plValidOp`와 `plApplyOp`를 둘 다 고치고, "두 번 적용해도 같은 결과"와 "되돌리기" 시험을 함께 추가하세요.

## 체중 가져오기 (iPhone 건강 앱)
- `plBi*` 함수군. 사용자가 고른 건강 앱 내보내기 파일(한국어: `내보내기.zip`, 영어: `export.zip`)을 기기 안에서만 읽습니다(서버 전송 없음).
  zip은 `DecompressionStream('deflate-raw')`로 조각조각 풀고, `plBiScan`이 몸무게(`HKQuantityTypeIdentifierBodyMass`) 기록만 뽑습니다.
- zip 안의 XML 고르기(`plBiZipEntry`): `export.xml`이 있으면 그것, 없으면 가장 큰 `.xml`(단 `*_cda.xml`, 점 파일, `__MACOSX/` 제외).
  한국어 iPhone은 파일 이름이 `내보내기.xml`이라서, `export.xml`만 찾던 때에는 "파일을 읽지 못해요" 오류가 났습니다(2026-11-22 수정).
- 하루에 여러 번 잰 값은 `mode`로 고릅니다: `'morning'`(오전 4~11시 중 가장 이른 값, 없으면 그날 첫 값 — 화면 기본), `'first'`, `'avg'`.
  기록은 0.01kg 단위로 저장하고 하루 값은 0.1kg로 반올림합니다. 사용자가 미리보기에서 확인한 날짜만 `setBodyWeights`로 저장하고,
  방금 가져온 것은 `undoBodyWeights`로 되돌릴 수 있습니다.
- 붙여 넣은 목록("2026-11-21 70.4" 형식)도 지원합니다. 한도: 글자 5MB, 기록 30만 건(`PL_BI_*` 상수).

## 서비스 워커·배포
- 배포: 이 저장소에는 배포 설정(`.github/workflows`)이 없고, main에 올리면 GitHub Pages가 루트 파일을 그대로 공개합니다.
  주소는 `https://ljcletter-byte.github.io/bakgong-log/`. 올린 뒤에는 Pages 빌드가 성공했는지 확인합니다.
- `sw.js`의 캐시 이름은 `bakdong-log-v4`. 페이지 이동(navigate)은 "네트워크 우선"(온라인이면 항상 최신), 오프라인일 때만 저장본을 씁니다.
  아이콘 같은 정적 파일은 저장본 우선입니다. 수정이 폰에 반영되지 않는 문제를 막기 위한 구조이니 바꿀 때 주의하고,
  `sw.js`나 저장되는 파일 목록을 바꾸면 `CACHE_NAME` 숫자도 올립니다.

## 시험 방법
- 저장소에는 자동 시험 도구가 없습니다(대화 작업 공간에서 임시로 만들어 썼습니다). 고칠 때는 이렇게 확인했습니다.
  jsdom으로 `index.html`의 스크립트를 가짜 Firebase와 함께 실행해 계산·저장 로직을 확인하고,
  Playwright(Chromium)로 실제 화면을 조작합니다(320px 같은 좁은 폭 포함, 체중 가져오기 파일 선택 포함).
- 한글 이름 파일을 Chromium `setInputFiles`로 올릴 때는 환경변수 `LANG=C.UTF-8`이 필요합니다.
- 시험용 정적 서버는 GitHub Pages처럼 `Cache-Control: max-age=600` + ETag로 띄워야 서비스 워커·캐시 문제를 재현할 수 있습니다.
  `.css`·`.js`의 MIME 타입도 맞춰야 합니다.
- 개인 건강 파일로 얻은 값은 시험 기준으로만 쓰고 저장소에 남기지 않습니다.

## 최근 이력
- 2026-11-21 저장 안정성·계산·화면 문제 수정(코드 검토 1~10번), 훌라후프 보완
- 2026-11-22 근력 기록·허리둘레·한 번에 저장·디자인 전체 정리
- 2026-11-22 체중 가져오기(건강 앱 내보내기 파일·목록 붙여 넣기) 추가, 몸무게 그래프 최근 90일
- 2026-11-22 한국어 iPhone 파일 이름(`내보내기.xml`) 읽기 수정, 하루 여러 번 잰 체중은 아침 값으로
