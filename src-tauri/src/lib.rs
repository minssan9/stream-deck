mod ble_server;
mod macro_engine;

use ble_server::start_ble_server;
use macro_engine::execute_macro;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_macro, start_ble_server])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
