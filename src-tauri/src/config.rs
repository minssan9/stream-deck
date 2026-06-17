use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const CONFIG_FILE: &str = "button_config.json";

/// A single step in a macro. Mirrors `MacroAction` in `macro_engine.rs` and
/// `MacroAction` in `src/types.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum MacroActionConfig {
    KeyPress { keys: Vec<String> },
    Delay { ms: u64 },
    OpenApp { path: String },
}

/// Persisted configuration for one Stream Deck button.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ButtonConfig {
    pub id: String,
    pub label: String,
    #[serde(rename = "macro")]
    pub macro_actions: Vec<MacroActionConfig>,
}

/// Serialize `configs` to a JSON string.
pub fn serialize_config(configs: &[ButtonConfig]) -> Result<String, String> {
    serde_json::to_string_pretty(configs).map_err(|e| format!("failed to serialize config: {e}"))
}

/// Deserialize a JSON string produced by [`serialize_config`] back into button configs.
pub fn parse_config(json: &str) -> Result<Vec<ButtonConfig>, String> {
    if json.trim().is_empty() {
        return Err("config file is empty".to_string());
    }
    serde_json::from_str::<Vec<ButtonConfig>>(json).map_err(|e| format!("failed to parse config: {e}"))
}

/// Resolve the path at which the config file is stored, using `app_data_dir()` when
/// available and falling back to the current working directory.
pub fn config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(CONFIG_FILE)
}

/// Load button configs from disk. Returns an error if the file does not exist or cannot
/// be parsed; the caller is expected to fall back to the default layout in that case.
#[tauri::command]
pub async fn load_button_config(app: tauri::AppHandle) -> Result<Vec<ButtonConfig>, String> {
    let path = config_path(&app);
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("could not read '{}': {e}", path.display()))?;
    parse_config(&json)
}

/// Persist `configs` to disk, creating the parent directory if necessary.
#[tauri::command]
pub async fn save_button_config(
    app: tauri::AppHandle,
    configs: Vec<ButtonConfig>,
) -> Result<(), String> {
    let path = config_path(&app);

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("could not create config dir: {e}"))?;
    }

    let json = serialize_config(&configs)?;
    std::fs::write(&path, json).map_err(|e| format!("could not write '{}': {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_configs() -> Vec<ButtonConfig> {
        vec![
            ButtonConfig {
                id: "btn_1".into(),
                label: "Copy".into(),
                macro_actions: vec![MacroActionConfig::KeyPress {
                    keys: vec!["Control".into(), "c".into()],
                }],
            },
            ButtonConfig {
                id: "btn_2".into(),
                label: "Wait".into(),
                macro_actions: vec![MacroActionConfig::Delay { ms: 200 }],
            },
            ButtonConfig {
                id: "btn_3".into(),
                label: "Notepad".into(),
                macro_actions: vec![MacroActionConfig::OpenApp {
                    path: "notepad.exe".into(),
                }],
            },
        ]
    }

    #[test]
    fn round_trips_config() {
        let original = sample_configs();
        let json = serialize_config(&original).expect("should serialize");
        let parsed = parse_config(&json).expect("should parse");
        assert_eq!(original, parsed);
    }

    #[test]
    fn fails_on_empty_string() {
        let err = parse_config("").unwrap_err();
        assert!(err.contains("empty"));
    }

    #[test]
    fn fails_on_whitespace_only() {
        let err = parse_config("   \n  ").unwrap_err();
        assert!(err.contains("empty"));
    }

    #[test]
    fn fails_on_malformed_json() {
        let err = parse_config("not json at all").unwrap_err();
        assert!(err.contains("failed to parse config"));
    }

    #[test]
    fn fails_on_wrong_schema() {
        let err = parse_config(r#"{"key":"value"}"#).unwrap_err();
        assert!(err.contains("failed to parse config"));
    }

    #[test]
    fn all_action_types_round_trip() {
        let configs = vec![ButtonConfig {
            id: "btn_1".into(),
            label: "Multi-step".into(),
            macro_actions: vec![
                MacroActionConfig::KeyPress {
                    keys: vec!["Control".into(), "Shift".into(), "s".into()],
                },
                MacroActionConfig::Delay { ms: 100 },
                MacroActionConfig::OpenApp {
                    path: "/usr/bin/vim".into(),
                },
            ],
        }];

        let json = serialize_config(&configs).unwrap();
        assert_eq!(parse_config(&json).unwrap(), configs);
    }
}
