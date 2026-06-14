/** A single step in a macro. Mirrors `MacroAction` in `src-tauri/src/macro_engine.rs`. */
export type MacroAction =
  | { type: "KeyPress"; keys: string[] }
  | { type: "Delay"; ms: number }
  | { type: "OpenApp"; path: string };

/** Configuration for a single Stream Deck button. */
export interface DeckButtonConfig {
  id: string;
  label: string;
  macro: MacroAction[];
}

/** Payload received from the mobile device over BLE. Mirrors `ButtonEvent` in `ble_server.rs`. */
export interface ButtonEvent {
  button_id: string;
  action: string;
}
