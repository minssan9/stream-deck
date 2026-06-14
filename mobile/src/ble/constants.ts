/**
 * BLE identifiers shared with the desktop host. Must match
 * `BUTTON_SERVICE_UUID` / `BUTTON_CHAR_UUID` in `src-tauri/src/ble_server.rs`.
 */
export const SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb";
export const CHARACTERISTIC_UUID = "0000ff01-0000-1000-8000-00805f9b34fb";

/** Advertised device name. Must match `TARGET_DEVICE_NAME` on the desktop host. */
export const DEVICE_NAME = "StreamDeckRemote";

// GATT characteristic permission/property bitmasks, from
// android.bluetooth.BluetoothGattCharacteristic.
export const GATT_PERMISSION_READ = 0x01;
export const GATT_PROPERTY_READ = 0x02;
export const GATT_PROPERTY_NOTIFY = 0x10;
