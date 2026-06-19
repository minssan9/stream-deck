package com.streamdeckremote

import android.bluetooth.BluetoothGatt
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native module that exposes `requestConnectionPriority` to JavaScript.
 *
 * Android's `BluetoothGatt.requestConnectionPriority()` asks the BLE stack to
 * renegotiate the connection interval. `CONNECTION_PRIORITY_HIGH` targets ~7.5 ms,
 * enabling notification latencies well below 50 ms.
 *
 * Usage from JS/TS:
 *   import { NativeModules } from 'react-native';
 *   NativeModules.ConnectionPriority.requestHigh();
 *
 * Must be registered via [ConnectionPriorityPackage] in `MainApplication.kt`.
 */
class ConnectionPriorityModule(
    private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    /** Holds the active GATT connection set by `setGatt()`. */
    private var gatt: BluetoothGatt? = null

    override fun getName(): String = "ConnectionPriority"

    /**
     * Called from [PeripheralService] once the desktop host connects, so this module
     * can hold a reference to the GATT connection and issue priority requests.
     */
    fun setGatt(bluetoothGatt: BluetoothGatt) {
        gatt = bluetoothGatt
    }

    /**
     * Request `CONNECTION_PRIORITY_HIGH` (~7.5 ms interval). Call this once after the
     * desktop host subscribes to the button characteristic.
     */
    @ReactMethod
    fun requestHigh(promise: Promise) {
        val g = gatt
        if (g == null) {
            promise.reject("NO_GATT", "No active GATT connection — call setGatt() first")
            return
        }
        val success = g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_HIGH)
        if (success) {
            promise.resolve(null)
        } else {
            promise.reject("REQUEST_FAILED", "requestConnectionPriority returned false")
        }
    }

    /** Restore `CONNECTION_PRIORITY_BALANCED` when the session ends to save battery. */
    @ReactMethod
    fun requestBalanced(promise: Promise) {
        val g = gatt
        if (g == null) {
            promise.resolve(null)
            return
        }
        g.requestConnectionPriority(BluetoothGatt.CONNECTION_PRIORITY_BALANCED)
        promise.resolve(null)
    }
}
