import { useEffect } from "react";
import KeepAwake from "react-native-keep-awake";

/**
 * Force the screen to stay on while `enabled` is true. This is required because Android
 * and iOS aggressively suspend BLE peripheral advertising/GATT servers once the screen
 * locks, which would otherwise drop the connection to the desktop host.
 */
export function useKeepAwake(enabled = true): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    KeepAwake.activate();
    return () => {
      KeepAwake.deactivate();
    };
  }, [enabled]);
}
