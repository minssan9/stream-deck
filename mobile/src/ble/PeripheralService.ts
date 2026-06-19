import { NativeModules, Platform } from "react-native";
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

/** Android-only native module registered by ConnectionPriorityPackage. */
const ConnectionPriority: {
  requestHigh: () => Promise<void>;
  requestBalanced: () => Promise<void>;
} | null = Platform.OS === "android" ? (NativeModules.ConnectionPriority ?? null) : null;

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

  // On Android, request high connection priority once the peripheral is up.
  // This asks the BLE stack to use a ~7.5 ms connection interval, targeting <50 ms
  // notification latency. iOS does not expose a peripheral-side API for this.
  if (ConnectionPriority) {
    try {
      await ConnectionPriority.requestHigh();
    } catch {
      // Best-effort: failure here doesn't block functionality, just impacts latency.
    }
  }
}

/** Stop advertising and tear down the GATT server. */
export function stopPeripheral(): void {
  if (!started) {
    return;
  }

  if (ConnectionPriority) {
    try { await ConnectionPriority.requestBalanced(); } catch { /* ignore */ }
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
