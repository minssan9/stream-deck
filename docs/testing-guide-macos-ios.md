# Testing Guide — macOS (Desktop Host) + iOS (Mobile Remote)

## Prerequisites

### macOS Desktop Host
| Tool | Version | Install |
|------|---------|---------|
| Rust | ≥ 1.80 | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Node.js | ≥ 20 | `brew install node` |
| Xcode CLI | latest | `xcode-select --install` |
| Tauri CLI | v2 | included via `npm install` |

### iOS Companion App (React Native)
| Tool | Version | Install |
|------|---------|---------|
| Xcode | ≥ 15 | Mac App Store |
| CocoaPods | ≥ 1.14 | `brew install cocoapods` |
| React Native CLI | 0.75 | `npm install -g react-native-cli` |
| iOS Simulator / physical iPhone | iOS ≥ 15 | Xcode → Devices |

> **Note:** iOS BLE peripheral mode (`CBPeripheralManager`) works in the simulator but advertising to external devices (the Mac) requires a **physical iPhone**. Run BLE end-to-end tests on a real device.

---

## Part 1 — macOS Desktop Host

### 1-1. Clone & install

```bash
git clone https://github.com/minssan9/stream-deck.git
cd stream-deck
npm install
```

### 1-2. Grant Bluetooth permission (first run)

macOS requires an explicit privacy permission for apps accessing Bluetooth.

1. Build the app in dev mode once to register it with the OS:

   ```bash
   npm run tauri dev
   ```

2. When the system dialog appears → click **Allow**.
3. If the dialog never appears: **System Settings → Privacy & Security → Bluetooth** → add the entry manually by clicking **+** and selecting the app binary (`stream-deck-host`).

`src-tauri/Info.plist` already contains `NSBluetoothAlwaysUsageDescription`, which is required for the permission dialog to appear.

### 1-3. Run unit tests (Rust)

```bash
cd src-tauri
cargo test
```

Expected: `17 passed; 0 failed`.

Tests cover:
- `config::` — round-trip serialize/parse, empty/malformed input
- `ble_server::` — button-event parsing, connection-status serialization
- `macro_engine::` — all action types, key-name mapping

### 1-4. Run the app

```bash
# from repo root
npm run tauri dev
```

The 900 × 700 window opens. Test checklist:

| # | Action | Expected |
|---|--------|----------|
| 1 | Click any button | Button highlights green for 400 ms |
| 2 | Hover button → click pencil icon | Edit modal opens |
| 3 | Change label → Save | Button label updates immediately |
| 4 | Change KeyPress keys (e.g. `Control, c`) → Save → click button | Key combo fired (test in a text editor) |
| 5 | Add Delay step (200 ms) → Save → click | Perceptible pause before subsequent action |
| 6 | Add OpenApp step (`/Applications/TextEdit.app`) → Save → click | TextEdit opens |
| 7 | Restart app | Edited labels/macros persist (loaded from disk) |

Config is saved to:
```
~/Library/Application Support/com.minss.stream-deck-host/button_config.json
```

### 1-5. Test BLE scanning (without mobile device)

Click **Connect Bluetooth** in the header.

Expected behaviour (no device nearby):
- Status pill turns amber → shows `"Scanning for device..."`
- After 10 s scan timeout → status turns red → shows error message
- After 3 s the app auto-retries (reconnect loop) — status returns to amber

No crash, no hung UI. Close the window normally.

### 1-6. Release build

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/macos/Stream Deck Host.app`

Code-sign & notarize for distribution:

```bash
# Sign (replace IDENTITY with your Apple Developer identity)
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAMID)" \
  "src-tauri/target/release/bundle/macos/Stream Deck Host.app"

# Notarize
xcrun notarytool submit \
  "src-tauri/target/release/bundle/macos/Stream Deck Host.dmg" \
  --apple-id your@email.com \
  --password "@keychain:AC_PASSWORD" \
  --team-id TEAMID \
  --wait
```

---

## Part 2 — iOS Companion App (React Native)

### 2-1. Scaffold React Native project

```bash
cd stream-deck           # repo root
npx react-native@0.75 init StreamDeckRemote \
  --template react-native-template-typescript \
  --directory mobile-app
cd mobile-app
```

### 2-2. Install BLE peripheral + keep-awake packages

```bash
npm install react-native-ble-peripheral react-native-keep-awake
cd ios && pod install && cd ..
```

### 2-3. Copy source files from `mobile/src/`

```bash
cp -r ../mobile/src/* src/
```

Replace the generated `App.tsx` with `src/App.tsx` from this repo.

### 2-4. Merge iOS permissions into `Info.plist`

Open `mobile-app/ios/StreamDeckRemote/Info.plist` and add the keys from
`mobile/ios/Info.plist.snippet.xml`:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Stream Deck Remote uses Bluetooth to send button presses to the Stream Deck Host app on your computer.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Stream Deck Remote advertises itself over Bluetooth so the Stream Deck Host app on your computer can connect and receive button presses.</string>
<key>UIBackgroundModes</key>
<array>
    <string>bluetooth-peripheral</string>
</array>
```

### 2-5. Sign the app

In Xcode:
1. Open `mobile-app/ios/StreamDeckRemote.xcworkspace`
2. Select **StreamDeckRemote** target → **Signing & Capabilities**
3. Set **Team** to your Apple Developer account
4. Set **Bundle Identifier** (e.g. `com.yourname.streamdeckremote`)

### 2-6. Run on physical iPhone

```bash
npx react-native run-ios --device "Your iPhone Name"
```

Or build & run directly from Xcode (⌘R).

### 2-7. iOS BLE peripheral test checklist

| # | Action | Expected |
|---|--------|----------|
| 1 | App launches | "Starting BLE peripheral..." → "Advertising as StreamDeckRemote" |
| 2 | Screen stays on indefinitely | No sleep/lock (keep-awake active) |
| 3 | On desktop → click Connect Bluetooth | Desktop status: Scanning → Connected |
| 4 | Tap any button on iPhone | Desktop button highlights green; assigned macro executes |
| 5 | Lock iPhone screen | BLE connection drops within ~30 s (iOS suspends background peripheral) |
| 6 | Unlock iPhone | App resumes, desktop auto-reconnects within ~15 s |
| 7 | Kill app on iPhone | Desktop detects disconnect, retries scan every 3 s |

> **Keep-awake dependency:** `react-native-keep-awake` prevents screen lock while the app is in the foreground, which is the primary mechanism keeping peripheral mode alive on iOS. Background mode `bluetooth-peripheral` in `Info.plist` gives up to ~10 s of BLE execution time when backgrounded, after which iOS suspends it.

---

## Part 3 — End-to-End BLE Integration Test

Run both apps simultaneously:

```
Mac                               iPhone
─────────────────                 ────────────────────
npm run tauri dev         ←BLE→   npx react-native run-ios
Click "Connect Bluetooth"         (app auto-starts peripheral)
```

### Latency measurement

Open **Console.app** on Mac, filter by `stream-deck-host`. Timestamps on `ble-button-event` emissions show round-trip latency. Expected: **< 100 ms** on a clear 2.4 GHz environment (iOS does not expose `CONNECTION_PRIORITY_HIGH` via `react-native-ble-peripheral`; for < 50 ms a custom native module requesting `CBPeripheralManager` connection parameters is required).

### UUIDs (must match on both sides)

| Constant | Value |
|----------|-------|
| Service UUID | `0000ff00-0000-1000-8000-00805f9b34fb` |
| Characteristic UUID | `0000ff01-0000-1000-8000-00805f9b34fb` |
| Device Name | `StreamDeckRemote` |

---

## Known Limitations

| Issue | Mitigation |
|-------|-----------|
| iOS suspends peripheral when screen locks | Keep-awake keeps screen on while app is foreground |
| `react-native-ble-peripheral` does not support `CONNECTION_PRIORITY_HIGH` | Implement custom native Swift module calling `peripheral.maximumUpdateValueLength` + connection event handler |
| `btleplug` on macOS uses CoreBluetooth — adapter init fails without Bluetooth permission | Grant permission on first launch; app falls back gracefully with error event |
| Desktop auto-reconnect scans every 3 s — may miss device during iOS background suspension window | Increase scan window or implement BLE advertisement caching on desktop |
