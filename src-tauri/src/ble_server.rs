use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter, ValueNotification};
use btleplug::platform::Manager;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Name advertised by the mobile companion app. Used as a fallback match if the service UUID
/// is not present in the advertisement (some platforms omit 128-bit service UUIDs from scans).
pub const TARGET_DEVICE_NAME: &str = "StreamDeckRemote";

/// Service UUID exposed by the mobile companion app (GATT server / peripheral role).
/// The desktop host scans for this UUID specifically to avoid connecting to unrelated devices.
pub const BUTTON_SERVICE_UUID: Uuid = Uuid::from_u128(0x0000ff00_0000_1000_8000_00805f9b34fb);

/// Characteristic UUID that notifies the host whenever a button is pressed/released.
pub const BUTTON_CHAR_UUID: Uuid = Uuid::from_u128(0x0000ff01_0000_1000_8000_00805f9b34fb);

/// Name of the Tauri event emitted to the frontend whenever a button event is received.
pub const BUTTON_EVENT_NAME: &str = "ble-button-event";

/// Name of the Tauri event emitted whenever the BLE connection state changes.
pub const CONNECTION_EVENT_NAME: &str = "ble-connection-status";

/// Delay between reconnect attempts after a connection is lost or a connect attempt fails.
const RECONNECT_DELAY: Duration = Duration::from_secs(3);

/// How long to scan for the companion device before giving up on this attempt.
const SCAN_TIMEOUT: Duration = Duration::from_secs(10);

/// Ensures only one BLE listener loop is ever spawned, even if `start_ble_server` is invoked
/// multiple times (e.g. user clicks "Connect Bluetooth" repeatedly).
static LISTENER_RUNNING: AtomicBool = AtomicBool::new(false);

/// Payload received from the mobile device, e.g. `{"button_id":"btn_1","action":"press"}`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ButtonEvent {
    pub button_id: String,
    pub action: String,
}

/// Connection lifecycle state broadcast to the frontend via [`CONNECTION_EVENT_NAME`].
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionStatus {
    Scanning,
    Connected,
    Disconnected,
    Error,
}

#[derive(Debug, Clone, Serialize)]
struct ConnectionStatusPayload {
    status: ConnectionStatus,
    message: String,
}

/// Parse a raw BLE notification payload into a [`ButtonEvent`].
pub fn parse_button_event(bytes: &[u8]) -> Result<ButtonEvent, String> {
    serde_json::from_slice::<ButtonEvent>(bytes).map_err(|e| format!("invalid button event payload: {e}"))
}

fn emit_status(app_handle: &AppHandle, status: ConnectionStatus, message: impl Into<String>) {
    let payload = ConnectionStatusPayload {
        status,
        message: message.into(),
    };
    let _ = app_handle.emit(CONNECTION_EVENT_NAME, payload);
}

/// Find the companion peripheral by scanning for [`BUTTON_SERVICE_UUID`] (falling back to a
/// name match for adapters/platforms that don't surface 128-bit service UUIDs in scan reports).
async fn find_target_peripheral(
    adapter: &btleplug::platform::Adapter,
) -> Result<btleplug::platform::Peripheral, String> {
    let filter = ScanFilter {
        services: vec![BUTTON_SERVICE_UUID],
    };

    adapter
        .start_scan(filter)
        .await
        .map_err(|e| format!("failed to start BLE scan: {e}"))?;

    let deadline = tokio::time::Instant::now() + SCAN_TIMEOUT;
    let mut found = None;

    while tokio::time::Instant::now() < deadline {
        let peripherals = adapter
            .peripherals()
            .await
            .map_err(|e| format!("failed to list peripherals: {e}"))?;

        for peripheral in peripherals {
            if let Ok(Some(properties)) = peripheral.properties().await {
                let matches_service = properties.services.contains(&BUTTON_SERVICE_UUID);
                let matches_name = properties.local_name.as_deref() == Some(TARGET_DEVICE_NAME);

                if matches_service || matches_name {
                    found = Some(peripheral);
                    break;
                }
            }
        }

        if found.is_some() {
            break;
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    let _ = adapter.stop_scan().await;

    found.ok_or_else(|| format!("device '{TARGET_DEVICE_NAME}' not found within {SCAN_TIMEOUT:?}"))
}

/// Connect to the companion device, subscribe to button notifications, and forward every
/// received [`ButtonEvent`] to the frontend until the connection drops or an error occurs.
/// Returns `Ok(())` on a clean disconnect (which the caller will retry) and `Err` on a
/// connect/setup failure (which the caller also retries after a delay).
async fn connect_and_listen(app_handle: &AppHandle) -> Result<(), String> {
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

    emit_status(app_handle, ConnectionStatus::Scanning, "Scanning for device...");
    let peripheral = find_target_peripheral(&adapter).await?;

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

    // Note: btleplug does not expose a cross-platform API to request a BLE connection
    // priority / interval. To keep notification latency low (<50ms), the peripheral
    // (mobile app) should request CONNECTION_PRIORITY_HIGH on Android after connecting.
    peripheral
        .subscribe(&characteristic)
        .await
        .map_err(|e| format!("failed to subscribe to characteristic: {e}"))?;

    emit_status(app_handle, ConnectionStatus::Connected, "Connected");

    let mut notifications = peripheral
        .notifications()
        .await
        .map_err(|e| format!("failed to get notification stream: {e}"))?;

    loop {
        tokio::select! {
            notification = notifications.next() => {
                match notification {
                    Some(ValueNotification { value, .. }) => {
                        match parse_button_event(&value) {
                            Ok(event) => {
                                let _ = app_handle.emit(BUTTON_EVENT_NAME, event);
                            }
                            Err(err) => {
                                eprintln!("failed to parse BLE button event: {err}");
                            }
                        }
                    }
                    None => {
                        // Notification stream closed: the device disconnected.
                        return Ok(());
                    }
                }
            }
            _ = tokio::time::sleep(Duration::from_secs(1)) => {
                match peripheral.is_connected().await {
                    Ok(true) => continue,
                    _ => return Ok(()),
                }
            }
        }
    }
}

/// Run the connect/listen cycle in an infinite auto-reconnect loop. Any error from
/// [`connect_and_listen`] (scan timeout, connect failure, adapter error, etc.) is logged and
/// surfaced to the frontend, and the loop retries after [`RECONNECT_DELAY`] without crashing
/// the application.
async fn run_ble_listener(app_handle: AppHandle) {
    loop {
        match connect_and_listen(&app_handle).await {
            Ok(()) => {
                emit_status(&app_handle, ConnectionStatus::Disconnected, "Device disconnected");
            }
            Err(err) => {
                eprintln!("BLE connection error: {err}");
                emit_status(&app_handle, ConnectionStatus::Error, err);
            }
        }

        tokio::time::sleep(RECONNECT_DELAY).await;
    }
}

/// Tauri command entry point: kick off the BLE scan/connect/listen/reconnect loop in the
/// background and return immediately so the UI is not blocked. Safe to call multiple times -
/// only one listener loop will ever run.
#[tauri::command]
pub async fn start_ble_server(app_handle: AppHandle) -> Result<String, String> {
    if LISTENER_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok("BLE server already running".to_string());
    }

    tauri::async_runtime::spawn(run_ble_listener(app_handle));

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

    #[test]
    fn connection_status_serializes_snake_case() {
        let payload = ConnectionStatusPayload {
            status: ConnectionStatus::Scanning,
            message: "Scanning for device...".into(),
        };
        let json = serde_json::to_string(&payload).unwrap();
        assert_eq!(json, r#"{"status":"scanning","message":"Scanning for device..."}"#);
    }
}
