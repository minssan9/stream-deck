use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter, ValueNotification};
use btleplug::platform::Manager;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Name advertised by the mobile companion app. Used to identify the device to connect to.
pub const TARGET_DEVICE_NAME: &str = "StreamDeckRemote";

/// Service UUID exposed by the mobile companion app.
#[allow(dead_code)]
pub const BUTTON_SERVICE_UUID: Uuid = Uuid::from_u128(0x0000ff00_0000_1000_8000_00805f9b34fb);

/// Characteristic UUID that notifies the host whenever a button is pressed/released.
pub const BUTTON_CHAR_UUID: Uuid = Uuid::from_u128(0x0000ff01_0000_1000_8000_00805f9b34fb);

/// Name of the Tauri event emitted to the frontend whenever a button event is received.
pub const BUTTON_EVENT_NAME: &str = "ble-button-event";

/// Payload received from the mobile device, e.g. `{"button_id":"btn_1","action":"press"}`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ButtonEvent {
    pub button_id: String,
    pub action: String,
}

/// Parse a raw BLE notification payload into a [`ButtonEvent`].
pub fn parse_button_event(bytes: &[u8]) -> Result<ButtonEvent, String> {
    serde_json::from_slice::<ButtonEvent>(bytes).map_err(|e| format!("invalid button event payload: {e}"))
}

/// Scan for the companion device, connect, subscribe to button notifications, and forward
/// every received [`ButtonEvent`] to the frontend as a `ble-button-event` Tauri event.
async fn run_ble_listener(app_handle: AppHandle) -> Result<(), String> {
    let manager = Manager::new()
        .await
        .map_err(|e| format!("failed to init BLE manager: {e}"))?;

    let adapters = manager
        .adapters()
        .await
        .map_err(|e| format!("failed to list BLE adapters: {e}"))?;

    let adapter = adapters
        .into_iter()
        .next()
        .ok_or_else(|| "no BLE adapter found".to_string())?;

    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|e| format!("failed to start BLE scan: {e}"))?;

    // Give the adapter a moment to discover nearby peripherals.
    tokio::time::sleep(Duration::from_secs(2)).await;

    let peripherals = adapter
        .peripherals()
        .await
        .map_err(|e| format!("failed to list peripherals: {e}"))?;

    let mut target = None;
    for peripheral in peripherals {
        if let Ok(Some(properties)) = peripheral.properties().await {
            if properties.local_name.as_deref() == Some(TARGET_DEVICE_NAME) {
                target = Some(peripheral);
                break;
            }
        }
    }

    let peripheral = target.ok_or_else(|| format!("device '{TARGET_DEVICE_NAME}' not found"))?;

    peripheral
        .connect()
        .await
        .map_err(|e| format!("failed to connect to device: {e}"))?;

    peripheral
        .discover_services()
        .await
        .map_err(|e| format!("failed to discover services: {e}"))?;

    let characteristic = peripheral
        .characteristics()
        .into_iter()
        .find(|c| c.uuid == BUTTON_CHAR_UUID)
        .ok_or_else(|| format!("characteristic {BUTTON_CHAR_UUID} not found"))?;

    peripheral
        .subscribe(&characteristic)
        .await
        .map_err(|e| format!("failed to subscribe to characteristic: {e}"))?;

    let mut notifications = peripheral
        .notifications()
        .await
        .map_err(|e| format!("failed to get notification stream: {e}"))?;

    while let Some(ValueNotification { value, .. }) = notifications.next().await {
        match parse_button_event(&value) {
            Ok(event) => {
                let _ = app_handle.emit(BUTTON_EVENT_NAME, event);
            }
            Err(err) => {
                eprintln!("failed to parse BLE button event: {err}");
            }
        }
    }

    Ok(())
}

/// Tauri command entry point: kick off the BLE scan/connect/listen loop in the background
/// and return immediately so the UI is not blocked.
#[tauri::command]
pub async fn start_ble_server(app_handle: AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn(async move {
        if let Err(err) = run_ble_listener(app_handle).await {
            eprintln!("BLE listener stopped: {err}");
        }
    });

    Ok("BLE server starting".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_button_event() {
        let bytes = br#"{"button_id":"btn_1","action":"press"}"#;
        let event = parse_button_event(bytes).expect("payload should parse");
        assert_eq!(
            event,
            ButtonEvent {
                button_id: "btn_1".into(),
                action: "press".into(),
            }
        );
    }

    #[test]
    fn rejects_malformed_button_event() {
        let bytes = b"not json";
        let err = parse_button_event(bytes).unwrap_err();
        assert!(err.contains("invalid button event payload"));
    }

    #[test]
    fn rejects_missing_fields() {
        let bytes = br#"{"button_id":"btn_1"}"#;
        assert!(parse_button_event(bytes).is_err());
    }
}
