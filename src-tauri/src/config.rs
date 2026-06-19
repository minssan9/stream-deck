use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

const PROFILES_FILE: &str = "profiles.json";
const LEGACY_BUTTONS_FILE: &str = "button_config.json";

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
    /// Emoji character or a `data:image/...;base64,...` string for custom icons.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(rename = "macro")]
    pub macro_actions: Vec<MacroActionConfig>,
}

/// A named page of 15 buttons. Multiple profiles can be saved and switched at runtime.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub buttons: Vec<ButtonConfig>,
}

/// Root persisted structure — a list of profiles plus the id of the active one.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProfileStore {
    pub active_id: String,
    pub profiles: Vec<Profile>,
}

// ── serialization helpers ────────────────────────────────────────────────────

pub fn serialize_profiles(store: &ProfileStore) -> Result<String, String> {
    serde_json::to_string_pretty(store).map_err(|e| format!("failed to serialize profiles: {e}"))
}

pub fn parse_profiles(json: &str) -> Result<ProfileStore, String> {
    if json.trim().is_empty() {
        return Err("profiles file is empty".to_string());
    }
    serde_json::from_str::<ProfileStore>(json).map_err(|e| format!("failed to parse profiles: {e}"))
}

/// Legacy flat-list format used before profiles were introduced.
pub fn parse_legacy_buttons(json: &str) -> Result<Vec<ButtonConfig>, String> {
    if json.trim().is_empty() {
        return Err("config file is empty".to_string());
    }
    serde_json::from_str::<Vec<ButtonConfig>>(json)
        .map_err(|e| format!("failed to parse config: {e}"))
}

pub fn serialize_legacy(configs: &[ButtonConfig]) -> Result<String, String> {
    serde_json::to_string_pretty(configs).map_err(|e| format!("failed to serialize config: {e}"))
}

// ── path helpers ─────────────────────────────────────────────────────────────

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

fn profiles_path(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join(PROFILES_FILE)
}

fn legacy_path(app: &tauri::AppHandle) -> PathBuf {
    data_dir(app).join(LEGACY_BUTTONS_FILE)
}

fn ensure_dir(app: &tauri::AppHandle) -> Result<(), String> {
    std::fs::create_dir_all(data_dir(app)).map_err(|e| format!("could not create config dir: {e}"))
}

// ── profile commands ──────────────────────────────────────────────────────────

/// Load all profiles. If `profiles.json` is absent, attempts to migrate the legacy
/// `button_config.json` into a single "Default" profile, returning that.
/// Returns an error only when both files are missing/corrupt so the caller can
/// generate a fresh default layout.
#[tauri::command]
pub async fn load_profiles(app: tauri::AppHandle) -> Result<ProfileStore, String> {
    let path = profiles_path(&app);

    // Primary path: profiles.json exists.
    if path.exists() {
        let json = std::fs::read_to_string(&path)
            .map_err(|e| format!("could not read profiles: {e}"))?;
        return parse_profiles(&json);
    }

    // Migration path: promote legacy button_config.json to default profile.
    let legacy = legacy_path(&app);
    if legacy.exists() {
        let json = std::fs::read_to_string(&legacy)
            .map_err(|e| format!("could not read legacy config: {e}"))?;
        let buttons = parse_legacy_buttons(&json)?;
        let store = ProfileStore {
            active_id: "default".into(),
            profiles: vec![Profile {
                id: "default".into(),
                name: "Default".into(),
                buttons,
            }],
        };
        // Persist as new format so migration only runs once.
        let migrated = serialize_profiles(&store)?;
        ensure_dir(&app)?;
        let _ = std::fs::write(&path, migrated);
        return Ok(store);
    }

    Err("no profiles file found".into())
}

/// Persist the full profile store.
#[tauri::command]
pub async fn save_profiles(
    app: tauri::AppHandle,
    store: ProfileStore,
) -> Result<(), String> {
    ensure_dir(&app)?;
    let json = serialize_profiles(&store)?;
    let path = profiles_path(&app);
    std::fs::write(&path, json)
        .map_err(|e| format!("could not write profiles: {e}"))
}

// ── legacy commands (kept for backward-compat; prefer profiles API) ───────────

pub fn config_path(app: &tauri::AppHandle) -> PathBuf {
    legacy_path(app)
}

#[tauri::command]
pub async fn load_button_config(app: tauri::AppHandle) -> Result<Vec<ButtonConfig>, String> {
    let path = config_path(&app);
    let json = std::fs::read_to_string(&path)
        .map_err(|e| format!("could not read '{}': {e}", path.display()))?;
    parse_legacy_buttons(&json)
}

#[tauri::command]
pub async fn save_button_config(
    app: tauri::AppHandle,
    configs: Vec<ButtonConfig>,
) -> Result<(), String> {
    ensure_dir(&app)?;
    let json = serialize_legacy(&configs)?;
    let path = config_path(&app);
    std::fs::write(&path, json)
        .map_err(|e| format!("could not write '{}': {e}", path.display()))
}

// ── tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn make_button(id: &str, label: &str) -> ButtonConfig {
        ButtonConfig {
            id: id.into(),
            label: label.into(),
            icon: None,
            macro_actions: vec![MacroActionConfig::KeyPress {
                keys: vec!["Control".into(), "c".into()],
            }],
        }
    }

    fn make_store() -> ProfileStore {
        ProfileStore {
            active_id: "p1".into(),
            profiles: vec![
                Profile {
                    id: "p1".into(),
                    name: "Work".into(),
                    buttons: vec![make_button("btn_1", "Copy"), make_button("btn_2", "Paste")],
                },
                Profile {
                    id: "p2".into(),
                    name: "Gaming".into(),
                    buttons: vec![make_button("btn_1", "Sprint")],
                },
            ],
        }
    }

    // ── profile round-trip ────────────────────────────────────────────────

    #[test]
    fn round_trips_profile_store() {
        let store = make_store();
        let json = serialize_profiles(&store).unwrap();
        assert_eq!(parse_profiles(&json).unwrap(), store);
    }

    #[test]
    fn profile_parse_fails_on_empty() {
        let err = parse_profiles("").unwrap_err();
        assert!(err.contains("empty"));
    }

    #[test]
    fn profile_parse_fails_on_garbage() {
        let err = parse_profiles("not json").unwrap_err();
        assert!(err.contains("failed to parse profiles"));
    }

    #[test]
    fn active_id_preserved_in_round_trip() {
        let store = make_store();
        let json = serialize_profiles(&store).unwrap();
        let loaded = parse_profiles(&json).unwrap();
        assert_eq!(loaded.active_id, "p1");
    }

    // ── icon field ────────────────────────────────────────────────────────

    #[test]
    fn icon_round_trips_emoji() {
        let btn = ButtonConfig {
            id: "btn_1".into(),
            label: "Play".into(),
            icon: Some("▶️".into()),
            macro_actions: vec![],
        };
        let store = ProfileStore {
            active_id: "p1".into(),
            profiles: vec![Profile {
                id: "p1".into(),
                name: "Default".into(),
                buttons: vec![btn.clone()],
            }],
        };
        let json = serialize_profiles(&store).unwrap();
        let loaded = parse_profiles(&json).unwrap();
        assert_eq!(loaded.profiles[0].buttons[0].icon, Some("▶️".into()));
    }

    #[test]
    fn icon_omitted_from_json_when_none() {
        let btn = make_button("btn_1", "Copy");
        assert!(btn.icon.is_none());
        let json = serde_json::to_string(&btn).unwrap();
        assert!(!json.contains("icon"));
    }

    // ── legacy button config ──────────────────────────────────────────────

    #[test]
    fn legacy_round_trips() {
        let configs = vec![
            make_button("btn_1", "Copy"),
            ButtonConfig {
                id: "btn_2".into(),
                label: "Wait".into(),
                icon: None,
                macro_actions: vec![MacroActionConfig::Delay { ms: 200 }],
            },
        ];
        let json = serialize_legacy(&configs).unwrap();
        assert_eq!(parse_legacy_buttons(&json).unwrap(), configs);
    }

    #[test]
    fn legacy_fails_on_empty() {
        let err = parse_legacy_buttons("").unwrap_err();
        assert!(err.contains("empty"));
    }

    #[test]
    fn legacy_fails_on_malformed() {
        assert!(parse_legacy_buttons("not json").is_err());
    }

    #[test]
    fn all_action_types_round_trip_in_profile() {
        let store = ProfileStore {
            active_id: "p1".into(),
            profiles: vec![Profile {
                id: "p1".into(),
                name: "Default".into(),
                buttons: vec![ButtonConfig {
                    id: "btn_1".into(),
                    label: "Multi-step".into(),
                    icon: Some("🚀".into()),
                    macro_actions: vec![
                        MacroActionConfig::KeyPress {
                            keys: vec!["Control".into(), "Shift".into(), "s".into()],
                        },
                        MacroActionConfig::Delay { ms: 100 },
                        MacroActionConfig::OpenApp {
                            path: "/usr/bin/vim".into(),
                        },
                    ],
                }],
            }],
        };
        let json = serialize_profiles(&store).unwrap();
        assert_eq!(parse_profiles(&json).unwrap(), store);
    }
}
