# 파랑이 말랑이 · v1.1

기존 2D 디자인의 자동 호흡에 누르기·끌기·탄성 복원을 추가한 정적 웹앱입니다. 마우스와 터치를 지원하며, 파랑이에 키보드 포커스를 둔 상태에서 스페이스/엔터를 눌러도 작동합니다. 아직 실제 호스팅에는 배포하지 않았습니다.

## 바로 실행

Node.js 22 이상에서 프로젝트 폴더를 열고 실행합니다. 웹 화면만 실행할 때는 패키지 설치가 필요 없습니다.

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

React에서는 마운트 후 생성하고 effect 정리 함수에서 `destroy()`를 호출하면 됩니다. Android 앱은 아래 Capacitor 프로젝트로 빌드할 수 있습니다.

## Android 앱 빌드

Capacitor 8을 사용해 `dist/`를 앱 내부 WebView에서 실행합니다. 웹 파일이 APK에 포함되므로 별도 웹 서버 없이 실행됩니다. 현재 앱에는 LLM·STT 모델이 포함되어 있지 않습니다.

- 앱 이름: 파랑이 말랑이
- 앱 ID: `com.jklee3409.parang`
- 앱 버전: `1.1.0` (versionCode 1)
- 최소 지원: Android 7.0 / API 24
- 빌드 환경: Node.js 22 이상, JDK 21, Android SDK Platform 36 및 Build Tools 35.0.0

처음 저장소를 내려받았다면 `npm ci`로 의존성을 설치합니다. Android Studio의 SDK Manager에서 필요한 SDK를 설치하고, `JAVA_HOME`을 JDK 21 경로로 설정합니다. SDK 경로는 `ANDROID_HOME` 환경변수 또는 `android/local.properties`의 `sdk.dir`로 지정합니다.

```sh
npm ci
npm run android:build
```

Windows PowerShell에서 실행 정책 때문에 npm 실행이 막히면 `npm.cmd`를 사용하세요.

빌드 명령은 웹 파일을 Android 프로젝트에 동기화한 뒤 Debug APK를 생성합니다.

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

APK를 Android 휴대폰으로 옮겨 설치하거나, USB 디버깅을 켜고 `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`로 설치할 수 있습니다. 직접 APK를 여는 경우 해당 파일 앱의 '알 수 없는 앱 설치' 허용이 필요할 수 있습니다. Debug APK는 개발 확인용입니다.

Android Studio에서 열려면 `npm run android:open`, 웹 파일만 다시 복사하려면 `npm run android:sync`를 실행합니다. `dist/` 수정 후 APK에 반영하려면 `npm run android:build`로 다시 빌드하고 재설치하세요.

이 PC에 준비한 로컬 도구는 `tmp/android-tools/`에 있습니다. 빌드 스크립트는 해당 폴더의 JDK를 우선 사용하며, SDK 환경변수가 없으면 로컬 SDK를 사용합니다. Gradle 캐시는 기본적으로 `.gradle/`에 저장합니다. 이 도구와 캐시, APK, 복사된 웹 파일은 Git에서 제외되므로 다른 PC에서는 개발 환경을 별도로 준비해야 합니다.

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
