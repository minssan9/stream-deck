package com.streamdeckremote

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers [ConnectionPriorityModule] with React Native.
 *
 * Add to `MainApplication.kt` in `getPackages()`:
 *   packages.add(ConnectionPriorityPackage())
 */
class ConnectionPriorityPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(ConnectionPriorityModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
