# 파랑이 말랑이 · v1.1

기존 2D 디자인의 자동 호흡에 누르기·끌기·탄성 복원을 추가한 정적 웹앱입니다. 마우스와 터치를 지원하며, 파랑이에 키보드 포커스를 둔 상태에서 스페이스/엔터를 눌러도 작동합니다. 아직 실제 호스팅에는 배포하지 않았습니다.

## 바로 실행

Node.js 18 이상에서 프로젝트 폴더를 열고 실행합니다. 패키지 설치가 필요 없습니다.

```sh
npm start
```

브라우저에서 http://localhost:4173 을 엽니다. ES 모듈을 사용하므로 index.html을 더블클릭하는 대신 로컬 서버 또는 정적 호스팅을 사용하세요.

## 배포

`dist/`는 소스이자 완성된 배포 결과물입니다. **별도 빌드가 필요 없습니다.** 정적 호스팅의 공개 폴더로 `dist`를 지정하거나 그 안의 파일을 그대로 업로드하세요. 빌드 명령은 비워두면 됩니다. 상대 경로를 사용하여 하위 경로에서도 배포할 수 있습니다. 해당 경로는 `/parang/`처럼 끝에 슬래시가 있는 URL로 접근하세요.

배포할 파일:

```text
dist/
  index.html
  styles.css
  app.js
  parang-breathing.js
  assets/parang.png
```

런타임 외부 라이브러리, CDN, API, 환경변수는 필요하지 않습니다. `scripts/serve.mjs`는 로컬 확인용 서버이며 배포 서버로 실행할 필요가 없습니다.

## 다른 앱에 붙이기

`parang-breathing.js`는 프레임워크에 의존하지 않는 렌더러입니다. `img`와 `canvas`가 있는 button 컨테이너를 전달하세요. 버튼의 접근성 이름과 styles.css의 touch-action/focus-visible 규칙도 유지하세요. 이미지와 CSS도 함께 옮깁니다.

```js
import { ParangBreathing } from './parang-breathing.js';

const model = new ParangBreathing(container, {
  period: 4200,       // 한 번의 호흡 주기, 밀리초
  expansion: 0.075,   // 배 팽창 계수
  lift: 0.012,        // 상체 상승 계수
  fps: 30,
});

model.squeeze(0.51, 0.53); // 코드로 누르기 (0~1 정규화 좌표)
model.release();           // 누르기 해제
model.pause();   // 명시적으로 정지
model.start();   // 재개
model.destroy(); // 화면 제거 시 이벤트와 애니메이션 정리
```

React에서는 마운트 후 생성하고 effect 정리 함수에서 `destroy()`를 호출하면 됩니다. 네이티브 앱은 별도 프로젝트가 필요하며 이 웹앱을 WebView에 연결할 수 있습니다. 이 패키지는 APK/IPA가 아닙니다.

## 동작 및 설계

- 2D 이미지의 메시를 변형해 숨쉬기와 눌림을 표현합니다. 누르고 있는 동안 호흡 강도를 낮추고, 놓으면 탄성 복원과 함께 자연스럽게 이어집니다.
- 기기의 동작 줄이기가 켜져 있으면 복원의 튕김을 줄입니다. 호흡 자체는 요청대로 유지합니다.
- 로고를 제거한 1327×1186 무손실 PNG를 사용합니다. 캔버스는 실제 표시 크기 × 기기 픽셀 비율(최대 3배, 너비 최대 2048px)로 렌더링하고 창 크기와 픽셀 비율 변경을 반영합니다. 이미지 자체의 세부 정보는 원본 자산 해상도에 한정됩니다.
- 4.2초 주기로 자동 재생합니다. 사용자가 요청한 핵심 기능이므로 기기의 동작 줄이기 설정에서도 숨쉬기는 유지합니다.
- 숨겨진 탭이나 화면 밖에서는 정지하고, 돌아오면 재개합니다.
- 이미지가 준비되기 전이나 Canvas를 사용할 수 없는 경우 로고가 제거된 정적 이미지가 표시됩니다.
- 모바일과 데스크톱 크기에 맞춰 비율을 유지합니다.
- 불필요한 사용자 데이터 저장, 추적, 네트워크 요청은 없습니다.

사용자 제공 캐릭터 이미지가 포함되어 있습니다. 원본 이미지의 권리는 기존 권리자에게 있습니다.

## 이미지 편집 기록

내장 이미지 편집 기능으로 우측 하단 표시를 제거했습니다. 편집 지시: “Remove ONLY the tiny pale four-point sparkle/logo in the lower right corner, seamlessly reconstructing the plain gray backdrop. Preserve the character, face, pose, color, lighting, framing and aspect ratio. No redesign, cropping, added objects or text.” 프로젝트 내 최종 자산은 `dist/assets/parang.png`입니다.
