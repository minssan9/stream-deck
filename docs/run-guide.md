# Stream Deck — 실행 가이드

## 구조 요약

```
stream-deck/               ← 이 저장소
├── src/                   ← Tauri 프론트엔드 (React + TypeScript)
├── src-tauri/             ← Tauri 백엔드 (Rust)
└── mobile/src/            ← React Native 모바일 앱 소스 (코드만, 네이티브 프로젝트는 별도 생성)
```

- **데스크탑 앱** (`src-tauri`) : macOS / Windows 에서 실행, BLE Central 역할, 매크로 실행
- **모바일 앱** (`mobile/src`) : iPhone / Android 에서 실행, BLE Peripheral 역할, 버튼 입력 전송

---

## Part 1 — 데스크탑 앱 (macOS / Windows)

### 1-1. 필수 도구 설치

#### macOS
```bash
# Homebrew 없으면 먼저 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Node.js (v20 이상)
brew install node

# Xcode CLI (Tauri macOS 빌드에 필요)
xcode-select --install
```

#### Windows
```powershell
# Rust (rustup-init.exe 다운로드 후 실행)
winget install Rustlang.Rustup

# Node.js
winget install OpenJS.NodeJS.LTS

# WebView2 (Windows 11은 기본 내장)
# https://developer.microsoft.com/microsoft-edge/webview2/ 에서 설치
```

### 1-2. 저장소 클론 및 의존성 설치

```bash
git clone https://github.com/minssan9/stream-deck.git
cd stream-deck
npm install
```

### 1-3. 개발 모드 실행

```bash
npm run tauri dev
```

- 첫 실행 시 Rust 크레이트 컴파일 (5~10분 소요, 이후 증분 빌드)
- 브라우저 대신 네이티브 윈도우(900×700)가 열림
- 프론트엔드 변경 시 핫리로드, Rust 변경 시 재컴파일 후 자동 재시작

#### macOS — Bluetooth 권한 부여 (최초 1회)
앱 실행 후 시스템 대화상자 → **허용** 클릭  
대화상자가 뜨지 않으면:  
`시스템 설정 → 개인 정보 보호 및 보안 → Bluetooth → + 버튼 → stream-deck-host 추가`

### 1-4. 릴리즈 빌드

```bash
npm run tauri build
```

| OS | 결과물 경로 |
|----|------------|
| macOS | `src-tauri/target/release/bundle/macos/Stream Deck Host.app` |
| Windows | `src-tauri/target/release/bundle/msi/Stream Deck Host_x.x.x_x64_en-US.msi` |

### 1-5. Rust 단위 테스트

```bash
cd src-tauri
cargo test
```

예상 출력: `21 passed; 0 failed`

### 1-6. 설정 파일 위치

버튼 설정(프로필)은 아래 경로에 JSON으로 저장됩니다:

| OS | 경로 |
|----|------|
| macOS | `~/Library/Application Support/com.minss.stream-deck-host/profiles.json` |
| Windows | `%APPDATA%\com.minss.stream-deck-host\profiles.json` |

---

## Part 2 — 모바일 앱 (React Native)

> **전제조건:** `mobile/src/` 안의 소스를 React Native 프로젝트에 복사해서 사용합니다.  
> iOS는 macOS + Xcode 필수. Android는 Windows에서도 가능.

### 2-1. React Native 프로젝트 생성

```bash
# 저장소 루트에서
npx react-native@0.75 init StreamDeckRemote \
  --template react-native-template-typescript \
  --directory mobile-app

cd mobile-app
```

### 2-2. BLE 패키지 설치

```bash
npm install react-native-ble-peripheral react-native-keep-awake

# iOS
cd ios && pod install && cd ..
```

### 2-3. 소스 복사

```bash
# 저장소 루트 기준
cp -r ../mobile/src/* src/
```

기존 `App.tsx`를 복사한 `src/App.tsx`로 교체합니다.

### 2-4. iOS 권한 설정 (`Info.plist`)

`mobile-app/ios/StreamDeckRemote/Info.plist` 를 열고 `<dict>` 안에 추가:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Stream Deck Remote가 버튼 입력을 PC로 전송하기 위해 Bluetooth를 사용합니다.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Stream Deck Remote가 PC에서 연결할 수 있도록 Bluetooth로 광고합니다.</string>
<key>UIBackgroundModes</key>
<array>
    <string>bluetooth-peripheral</string>
</array>
```

### 2-5. Android 권한 설정 (`AndroidManifest.xml`)

`mobile-app/android/app/src/main/AndroidManifest.xml` 의 `<manifest>` 태그 안(≤`<application>`)에 추가:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission
    android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission
    android:name="android.permission.ACCESS_FINE_LOCATION"
    android:maxSdkVersion="30" />
<uses-feature android:name="android.hardware.bluetooth_le" android:required="true" />
```

### 2-6. Android 연결 우선순위 네이티브 모듈 등록

`mobile/android/ConnectionPriorityModule.kt` 와 `ConnectionPriorityPackage.kt` 를 복사:

```bash
cp ../mobile/android/ConnectionPriority*.kt \
   mobile-app/android/app/src/main/java/com/streamdeckremote/
```

`MainApplication.kt` 의 `getPackages()` 에 등록:

```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(ConnectionPriorityPackage())   // ← 추가
    }
```

### 2-7. Xcode 서명 (iOS 실기기 배포 시)

1. `mobile-app/ios/StreamDeckRemote.xcworkspace` 열기
2. Target → **Signing & Capabilities** → Team 선택
3. Bundle Identifier 설정 (예: `com.yourname.streamdeckremote`)

### 2-8. 실행

```bash
# iOS 시뮬레이터
npx react-native run-ios

# iOS 실기기 (BLE 실물 테스트는 실기기 필수)
npx react-native run-ios --device "내 iPhone 이름"

# Android
npx react-native run-android
```

---

## Part 3 — 기능 사용법

### 버튼 실행
버튼 클릭 → 연결된 매크로 즉시 실행 (초록 하이라이트 400ms)

### 버튼 편집
버튼 위에 마우스 올리기 → 우측 상단 ✏️ 아이콘 클릭 → EditModal

| 필드 | 설명 |
|------|------|
| Label | 버튼에 표시될 이름 |
| Icon | 이모지 입력 (예: 🚀 ▶️ 🎮) |
| Macro steps | KeyPress / Delay / OpenApp 순서대로 추가 |
| ▶ Test | 저장 없이 현재 매크로 즉시 실행 |

**KeyPress 키 이름 예시:**
```
Control, Shift, c          → Ctrl+Shift+C
Command, Space             → Spotlight (macOS)
Alt, F4                    → 창 닫기 (Windows)
F5                         → 새로고침
```

### 버튼 순서 변경
버튼을 클릭 후 드래그(8px 이동 후 활성화) → 원하는 위치에 드롭 → 자동 저장

### 프로필 관리
| 동작 | 방법 |
|------|------|
| 탭 전환 | 헤더 아래 탭 클릭 |
| 새 프로필 | `+` 버튼 → 이름 입력 |
| 이름 변경 | 탭 더블클릭 → 이름 입력 |
| 삭제 | 탭 hover → `✕` 버튼 (2개 이상일 때만) |

### Bluetooth 연결
1. 모바일 앱 실행 → "Advertising as StreamDeckRemote" 확인
2. 데스크탑 앱 → **Connect Bluetooth** 클릭
3. 헤더 상태 표시: 🟡 Scanning → 🟢 Connected
4. 연결 끊김 시 3초 후 자동 재스캔 (앱 재시작 불필요)

---

## Part 4 — 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `no BLE adapter found` | Bluetooth 꺼짐 또는 드라이버 없음 | Bluetooth 켜기; Windows: 드라이버 확인 |
| macOS — 권한 대화상자 안 뜸 | 이미 거부됨 | 시스템 설정 → Bluetooth → 앱 수동 추가 |
| Scanning 상태에서 멈춤 | 모바일 앱 미실행 또는 UUID 불일치 | 모바일 앱 먼저 실행; UUID 확인 (아래 표) |
| iOS 화면 잠금 시 연결 끊김 | iOS가 BLE 광고 중단 | 화면 자동잠금 해제 or 앱 포그라운드 유지 |
| Android `requestConnectionPriority` 실패 | GATT 연결 전 호출됨 | 데스크탑이 subscribe 후 자동 재시도됨 |
| 드래그가 바로 클릭으로 인식됨 | 이동 거리 < 8px | 조금 더 이동 후 드롭 |
| `cargo test` 실패 | Rust 버전 < 1.80 | `rustup update stable` |

### 공통 UUID (변경 시 양쪽 모두 수정 필요)

| 상수 | 값 |
|------|----|
| Service UUID | `0000ff00-0000-1000-8000-00805f9b34fb` |
| Characteristic UUID | `0000ff01-0000-1000-8000-00805f9b34fb` |
| Device Name | `StreamDeckRemote` |

데스크탑 → `src-tauri/src/ble_server.rs`  
모바일 → `mobile/src/ble/constants.ts`

---

## Part 5 — 개발 명령어 요약

```bash
# 데스크탑 개발 모드
npm run tauri dev

# 데스크탑 릴리즈 빌드
npm run tauri build

# TypeScript 타입 검사
npx tsc --noEmit

# Rust 테스트
cd src-tauri && cargo test

# 모바일 iOS
cd mobile-app && npx react-native run-ios

# 모바일 Android
cd mobile-app && npx react-native run-android
```
