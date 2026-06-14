use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use serde::Deserialize;
use std::process::Command;
use std::time::Duration;

/// A single step in a macro, deserialized from the JSON payload sent by the UI.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum MacroAction {
    /// Press (and release) a combination of keys, e.g. ["Command", "Shift", "C"].
    KeyPress { keys: Vec<String> },
    /// Sleep for the given number of milliseconds before continuing.
    Delay { ms: u64 },
    /// Open an application or file path using the OS shell/launcher.
    OpenApp { path: String },
}

/// Parse the JSON payload (an array of [`MacroAction`]) sent from the frontend.
pub fn parse_actions(payload: &str) -> Result<Vec<MacroAction>, String> {
    serde_json::from_str::<Vec<MacroAction>>(payload).map_err(|e| format!("invalid macro payload: {e}"))
}

/// Map a human-readable key name (as used in the frontend) to an [`enigo::Key`].
pub fn key_from_str(name: &str) -> Result<Key, String> {
    let key = match name.to_ascii_lowercase().as_str() {
        "ctrl" | "control" => Key::Control,
        "alt" | "option" => Key::Alt,
        "shift" => Key::Shift,
        "cmd" | "command" | "meta" | "win" | "windows" | "super" => Key::Meta,
        "enter" | "return" => Key::Return,
        "tab" => Key::Tab,
        "esc" | "escape" => Key::Escape,
        "space" => Key::Space,
        "backspace" => Key::Backspace,
        "delete" | "del" => Key::Delete,
        "up" | "arrowup" => Key::UpArrow,
        "down" | "arrowdown" => Key::DownArrow,
        "left" | "arrowleft" => Key::LeftArrow,
        "right" | "arrowright" => Key::RightArrow,
        "home" => Key::Home,
        "end" => Key::End,
        "pageup" => Key::PageUp,
        "pagedown" => Key::PageDown,
        "f1" => Key::F1,
        "f2" => Key::F2,
        "f3" => Key::F3,
        "f4" => Key::F4,
        "f5" => Key::F5,
        "f6" => Key::F6,
        "f7" => Key::F7,
        "f8" => Key::F8,
        "f9" => Key::F9,
        "f10" => Key::F10,
        "f11" => Key::F11,
        "f12" => Key::F12,
        other => {
            let mut chars = other.chars();
            match (chars.next(), chars.next()) {
                (Some(c), None) => Key::Unicode(c),
                _ => return Err(format!("unknown key: {name}")),
            }
        }
    };
    Ok(key)
}

/// Execute a single macro action against the given [`Enigo`] instance.
pub async fn execute_action(enigo: &mut Enigo, action: &MacroAction) -> Result<(), String> {
    match action {
        MacroAction::KeyPress { keys } => {
            let parsed: Vec<Key> = keys
                .iter()
                .map(|k| key_from_str(k))
                .collect::<Result<Vec<_>, _>>()?;

            // Press all keys in order, then release them in reverse order.
            for key in &parsed {
                enigo
                    .key(*key, Direction::Press)
                    .map_err(|e| format!("failed to press key {key:?}: {e}"))?;
            }
            for key in parsed.iter().rev() {
                enigo
                    .key(*key, Direction::Release)
                    .map_err(|e| format!("failed to release key {key:?}: {e}"))?;
            }
            Ok(())
        }
        MacroAction::Delay { ms } => {
            tokio::time::sleep(Duration::from_millis(*ms)).await;
            Ok(())
        }
        MacroAction::OpenApp { path } => open_path(path),
    }
}

/// Open an application or file path using the platform-appropriate launcher.
fn open_path(path: &str) -> Result<(), String> {
    let result = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "start", "", path]).spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg(path).spawn()
    } else {
        Command::new("xdg-open").arg(path).spawn()
    };

    result
        .map(|_| ())
        .map_err(|e| format!("failed to open '{path}': {e}"))
}

/// Parse and run a sequence of [`MacroAction`]s in order.
pub async fn run_macro(payload: &str) -> Result<(), String> {
    let actions = parse_actions(payload)?;
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| format!("failed to init input simulator: {e}"))?;

    for action in &actions {
        execute_action(&mut enigo, action).await?;
    }

    Ok(())
}

/// Tauri command entry point: parse a JSON array of [`MacroAction`] and execute it sequentially.
#[tauri::command]
pub async fn execute_macro(payload: String) -> Result<(), String> {
    run_macro(&payload).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_key_press_action() {
        let payload = r#"[{"type":"KeyPress","keys":["Command","Shift","c"]}]"#;
        let actions = parse_actions(payload).expect("payload should parse");
        assert_eq!(
            actions,
            vec![MacroAction::KeyPress {
                keys: vec!["Command".into(), "Shift".into(), "c".into()]
            }]
        );
    }

    #[test]
    fn parses_delay_action() {
        let payload = r#"[{"type":"Delay","ms":250}]"#;
        let actions = parse_actions(payload).expect("payload should parse");
        assert_eq!(actions, vec![MacroAction::Delay { ms: 250 }]);
    }

    #[test]
    fn parses_open_app_action() {
        let payload = r#"[{"type":"OpenApp","path":"/Applications/Safari.app"}]"#;
        let actions = parse_actions(payload).expect("payload should parse");
        assert_eq!(
            actions,
            vec![MacroAction::OpenApp {
                path: "/Applications/Safari.app".into()
            }]
        );
    }

    #[test]
    fn parses_mixed_sequence_in_order() {
        let payload = r#"[
            {"type":"KeyPress","keys":["Control","Alt","Delete"]},
            {"type":"Delay","ms":100},
            {"type":"OpenApp","path":"notepad.exe"}
        ]"#;
        let actions = parse_actions(payload).expect("payload should parse");
        assert_eq!(
            actions,
            vec![
                MacroAction::KeyPress {
                    keys: vec!["Control".into(), "Alt".into(), "Delete".into()]
                },
                MacroAction::Delay { ms: 100 },
                MacroAction::OpenApp {
                    path: "notepad.exe".into()
                },
            ]
        );
    }

    #[test]
    fn rejects_invalid_payload() {
        let err = parse_actions("not json").unwrap_err();
        assert!(err.contains("invalid macro payload"));
    }

    #[test]
    fn maps_known_key_names() {
        assert_eq!(key_from_str("ctrl").unwrap(), Key::Control);
        assert_eq!(key_from_str("Command").unwrap(), Key::Meta);
        assert_eq!(key_from_str("Shift").unwrap(), Key::Shift);
        assert_eq!(key_from_str("F5").unwrap(), Key::F5);
        assert_eq!(key_from_str("c").unwrap(), Key::Unicode('c'));
    }

    #[test]
    fn rejects_unknown_key_name() {
        assert!(key_from_str("not-a-real-key").is_err());
    }
}
