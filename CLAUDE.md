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
- 앱 전체가 `index.html` 한 파일입니다(CSS 약 570줄, JS 약 4500줄). 빌드 도구는 없습니다.
- 그 밖의 파일: `sw.js`(서비스 워커), `manifest.json`, 아이콘들, `privacy.html`(개인정보처리방침), `README.md`.
- 함수 이름은 모두 `pl` 접두어(예: `plRenderHome`), 전역 상수·상태는 `PL_` 접두어입니다.
- 화면은 4개 탭: `scr-today`(오늘) / `scr-add`(기록하기) / `scr-history`(지난 기록) / `scr-stats`(분석). `plGoTab('today')`처럼 이동합니다.
  기록하기 탭을 열면 마지막에 쓴 유산소 종류(없으면 훌라후프)가 미리 골라집니다(`plDefaultType`).
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
  이 상태에서는 화면의 설정이 '기본값'이라 `plSaveSettings`가 서버의 키·나이·성별·목표를 지워 버릴 수 있어서, 설정 저장을 막습니다(2026-11-23, 시험으로 확인).
- 새 변경 종류를 추가하면 `plValidOp`와 `plApplyOp`를 둘 다 고치고, "두 번 적용해도 같은 결과"와 "되돌리기" 시험을 함께 추가하세요.

## 화면 디자인 약속 (2026-11-23 디자이너 평가 12가지 반영)
- 글자: 한글이 낱말 중간에서 끊기지 않게 `body{word-break:keep-all;overflow-wrap:anywhere}`. 글자 크기는 `--fs-1`~`--fs-9` 토큰만 씁니다
  (rem, 1rem≈17px, 12/14/16/18/20/22/28/40/56px). px로 직접 쓰지 마세요(입력칸만 iOS 확대 방지로 `max(16px,var(--fs-3))`).
  iPhone의 '글자 크기' 설정은 `html{font:-apple-system-body}`(iOS만)로 따라가고, `plFitRootFont`가 26px까지만 키웁니다.
- 누르는 곳은 44×44px 이상(작게 보이는 ×는 `::after`로 범위만 넓힘). 예외: 글 중간의 링크, 7칸 달력(이번 주 칸은 폭 약 37px@320, 월간 달력 칸은 약 32px@320~42px@390).
- 색의 뜻: 초록=앱 대표색·목표 달성·좋은 변화 / 파랑=시간·몸무게 / 보라=근력·허리둘레 / 주황·빨강=주의·오류.
  운동 강도는 `--int-low`(파랑)→`--int-mid`(주황)→`--int-high`(빨강), 심박수가 없으면 `--int-none`(회색). 초록을 강도에 쓰지 않습니다.
  안내 글 `.calc-hint`는 회색, 계산이 끝난 결과(`.ok`)만 초록, 오류는 빨강(`.form-error`). 같은 문장을 색만 바꿔 두 가지 뜻으로 쓰지 않습니다.
- 모서리는 `--r-xs/sm/md/lg/xl/pill`, 그림자는 `--sh-sm/md/lg`만 씁니다.
- 덮개 화면(`.overlay`)은 세로 flex라서 `.overlay > *{flex-shrink:0}`이 꼭 필요합니다(없으면 `min-height`가 있는 안내 글 칸이 찌그러져 글자가 겹칩니다).
- 그래프: 한 그래프에는 한 가지 단위만(같은 단위끼리는 겹쳐도 됨). `plChartHTML`로 그리고 범위는 `plNiceRange`, 세로축 맨 위·아래 숫자를 적습니다.
  그래프 글자(숫자·날짜)는 SVG가 아니라 HTML이라야 화면 폭·글자 크기 설정과 상관없이 12px 이상으로 읽힙니다.
- 날짜는 `plDateKo(iso)` → "11월 20일 (금)"(올해가 아니면 연도가 앞에). 그래프 안의 짧은 "11/17"만 예외입니다.
- 설정: 저장이 필요한 값은 `설정 저장` 버튼 하나(API 키 포함, 키는 브라우저에만). 화면 색상만 바로 적용되고 이름표에 그렇게 적혀 있습니다.
- 불러오기 실패: 오늘·지난 기록·분석 화면에 `load-failed` 클래스가 붙고 `plLoadFailCardHTML` 카드만 보입니다(나머지는 CSS가 숨김).
  숨겨야 하는 요소에 인라인 `style="display:…"`를 쓰지 마세요(숨김 규칙이 안 먹습니다 — 지난 기록 필터가 그랬습니다).
- 접근성: 덮개 화면은 `role=dialog aria-modal`이고 열리면 포커스가 옮겨지며 뒤 화면은 `aria-hidden`(`plWatchOverlays`). div 버튼은 `role=button tabindex=0`
  (Enter·Space 동작), 글자 없는 버튼과 이름표 없는 입력칸은 `aria-label`, 그래프는 `role=img`+설명, 포커스 링은 `:focus-visible`.
- 로그인 화면의 예전 동기화 코드 입력은 접이식(`details.migrate-wrap`). 맨 위 머리글에는 이메일을 보이지 않습니다(설정에서만).
- 공유 이미지 `plShareWeekImage`는 1080×1440, 7일 동그라미는 `plDayStatus`(이번 주 칸과 같은 규칙).
- 앱 아이콘 `icon.svg`는 고리+박동선입니다. PNG 4종은 이 SVG를 Chromium으로 그려 만들었습니다
  (`apple-touch-icon.png`·`icon-maskable-512.png`는 모서리까지 꽉 찬 불투명, `icon-192/512.png`는 둥근 모서리+투명). 아이콘을 바꾸면 `CACHE_NAME`도 올립니다.
- 알려둘 점: 기록 상세의 링 색(그 운동의 최고 심박수 대비 평균)과 '강도 낮음' 같은 글자(내 지난 같은 종류 운동 안에서의 상대 위치)는 기준이 달라 서로 다르게 보일 수 있습니다. 사용자 확인 전에는 그대로 둡니다.

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
- `sw.js`의 캐시 이름은 `bakdong-log-v5`. 페이지 이동(navigate)은 "네트워크 우선"(온라인이면 항상 최신), 오프라인일 때만 저장본을 씁니다.
  아이콘 같은 정적 파일은 저장본 우선입니다. 수정이 폰에 반영되지 않는 문제를 막기 위한 구조이니 바꿀 때 주의하고,
  `sw.js`나 저장되는 파일 목록을 바꾸면 `CACHE_NAME` 숫자도 올립니다.

## 시험 방법
- 저장소에는 자동 시험 도구가 없습니다(대화 작업 공간에서 임시로 만들어 썼습니다). 고칠 때는 이렇게 확인했습니다.
  jsdom으로 `index.html`의 스크립트를 가짜 Firebase와 함께 실행해 계산·저장·문구·그래프 구성을 확인하고,
  Playwright(Chromium)로 실제 화면을 조작합니다(체중 가져오기 파일 선택 포함).
  화면을 고친 뒤에는 폭 390·375·320px, 어두운 화면, 큰 글자(기준 글자 21·23·26px 흉내)에서
  가로 넘침·누르는 크기(44px)·낱말 줄바꿈·칸 겹침/찌그러짐·글자 대비(4.5:1)·12px 미만 글자를 확인합니다.
- 한글 이름 파일을 Chromium `setInputFiles`로 올릴 때는 환경변수 `LANG=C.UTF-8`이 필요합니다.
- 시험용 정적 서버는 GitHub Pages처럼 `Cache-Control: max-age=600` + ETag로 띄워야 서비스 워커·캐시 문제를 재현할 수 있습니다.
  `.css`·`.js`의 MIME 타입도 맞춰야 합니다.
- 개인 건강 파일로 얻은 값은 시험 기준으로만 쓰고 저장소에 남기지 않습니다.

## 최근 이력
- 2026-11-21 저장 안정성·계산·화면 문제 수정(코드 검토 1~10번), 훌라후프 보완
- 2026-11-22 근력 기록·허리둘레·한 번에 저장·디자인 전체 정리
- 2026-11-22 체중 가져오기(건강 앱 내보내기 파일·목록 붙여 넣기) 추가, 몸무게 그래프 최근 90일
- 2026-11-22 한국어 iPhone 파일 이름(`내보내기.xml`) 읽기 수정, 하루 여러 번 잰 체중은 아침 값으로
- 2026-11-23 디자이너 평가 12가지 반영: 줄바꿈·색 약속·탭 이름·누르는 크기·그래프 분리와 세로축·설정 저장 통일·불러오기 실패 화면·글자 rem화·접근성·공유 그림·아이콘(`CACHE_NAME` v5). 불러오기 실패 중 설정 저장 차단 추가
