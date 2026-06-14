import BleManager from "react-native-ble-peripheral";
import {
  CHARACTERISTIC_UUID,
  DEVICE_NAME,
  GATT_PERMISSION_READ,
  GATT_PROPERTY_NOTIFY,
  GATT_PROPERTY_READ,
  SERVICE_UUID,
} from "./constants";
import type { ButtonEvent } from "../types";

let started = false;

/**
 * Configure and start the BLE GATT server, advertising a single service with a
 * notify characteristic that the desktop host subscribes to.
 *
 * Must be called once (e.g. on app launch) before {@link sendButtonEvent}.
 */
export async function startPeripheral(): Promise<void> {
  if (started) {
    return;
  }

  BleManager.setName(DEVICE_NAME);
  BleManager.addService(SERVICE_UUID, true);
  BleManager.addCharacteristicToService(
    SERVICE_UUID,
    CHARACTERISTIC_UUID,
    GATT_PERMISSION_READ,
    GATT_PROPERTY_READ | GATT_PROPERTY_NOTIFY,
  );

  await BleManager.start();
  started = true;
}

/** Stop advertising and tear down the GATT server. */
export function stopPeripheral(): void {
  if (!started) {
    return;
  }

  BleManager.stop();
  started = false;
}

/** Encode a JSON payload as a byte array for `sendNotificationToDevices`. */
function toByteArray(json: string): number[] {
  return Array.from(new TextEncoder().encode(json));
}

/**
 * Notify the connected desktop host of a button press/release.
 * Throws if {@link startPeripheral} has not completed yet.
 */
export async function sendButtonEvent(event: ButtonEvent): Promise<void> {
  if (!started) {
    throw new Error("BLE peripheral not started - call startPeripheral() first");
  }

  const bytes = toByteArray(JSON.stringify(event));
  await BleManager.sendNotificationToDevices(SERVICE_UUID, CHARACTERISTIC_UUID, bytes);
}

/** Whether the GATT server has been started in this app session. */
export function isPeripheralStarted(): boolean {
  return started;
}
