/** A single step in a macro. Mirrors `MacroAction` in `src-tauri/src/macro_engine.rs`. */
export type MacroAction =
  | { type: "KeyPress"; keys: string[] }
  | { type: "Delay"; ms: number }
  | { type: "OpenApp"; path: string };

/** Configuration for a single Stream Deck button. */
export interface DeckButtonConfig {
  id: string;
  label: string;
  /** Emoji char or data:image/...;base64,... URI. */
  icon?: string;
  macro: MacroAction[];
}

/** A named page of 15 buttons. Mirrors `Profile` in `config.rs`. */
export interface Profile {
  id: string;
  name: string;
  buttons: DeckButtonConfig[];
}

/** Root persisted structure. Mirrors `ProfileStore` in `config.rs`. */
export interface ProfileStore {
  active_id: string;
  profiles: Profile[];
}

/** Payload received from the mobile device over BLE. Mirrors `ButtonEvent` in `ble_server.rs`. */
export interface ButtonEvent {
  button_id: string;
  action: string;
}

/** BLE connection lifecycle event. Mirrors `ConnectionStatusPayload` in `ble_server.rs`. */
export interface BleConnectionStatusEvent {
  status: "scanning" | "connected" | "disconnected" | "error";
  message: string;
}
