import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import DeckButton from "./components/DeckButton";
import EditModal from "./components/EditModal";
import { DEFAULT_BUTTONS } from "./deckConfig";
import type { BleConnectionStatusEvent, ButtonEvent, DeckButtonConfig } from "./types";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const ACTIVE_HIGHLIGHT_MS = 400;

function App() {
  const [buttons, setButtons] = useState<DeckButtonConfig[]>(DEFAULT_BUTTONS);
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<DeckButtonConfig | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [statusMessage, setStatusMessage] = useState<string>("Not connected");
  const highlightTimeout = useRef<number | undefined>(undefined);

  const highlightButton = (id: string) => {
    setActiveButtonId(id);
    if (highlightTimeout.current) {
      window.clearTimeout(highlightTimeout.current);
    }
    highlightTimeout.current = window.setTimeout(() => {
      setActiveButtonId(null);
    }, ACTIVE_HIGHLIGHT_MS);
  };

  const runMacro = async (config: DeckButtonConfig) => {
    highlightButton(config.id);
    try {
      await invoke("execute_macro", { payload: JSON.stringify(config.macro) });
    } catch (err) {
      console.error("Failed to execute macro", err);
    }
  };

  useEffect(() => {
    invoke<DeckButtonConfig[]>("load_button_config")
      .then((loaded) => setButtons(loaded))
      .catch(() => { /* file not found on first run — keep DEFAULT_BUTTONS */ });
  }, []);

  const saveButtons = async (updated: DeckButtonConfig[]) => {
    setButtons(updated);
    try {
      await invoke("save_button_config", { configs: updated });
    } catch (err) {
      console.error("Failed to save button config", err);
    }
  };

  const handleEditSave = (updated: DeckButtonConfig) => {
    const next = buttons.map((b) => (b.id === updated.id ? updated : b));
    void saveButtons(next);
  };

  const connectBluetooth = async () => {
    setStatus("connecting");
    setStatusMessage("Starting BLE server...");
    try {
      await invoke<string>("start_ble_server");
    } catch (err) {
      setStatus("error");
      setStatusMessage(String(err));
    }
  };

  useEffect(() => {
    const unlistenButton = listen<ButtonEvent>("ble-button-event", (event) => {
      const { button_id } = event.payload;
      const config = buttons.find((b) => b.id === button_id);
      if (config) {
        void runMacro(config);
      }
    });

    const unlistenStatus = listen<BleConnectionStatusEvent>("ble-connection-status", (event) => {
      const { status: bleStatus, message } = event.payload;
      switch (bleStatus) {
        case "scanning":
          setStatus("connecting");
          break;
        case "connected":
          setStatus("connected");
          break;
        case "disconnected":
          setStatus("disconnected");
          break;
        case "error":
          setStatus("error");
          break;
      }
      setStatusMessage(message);
    });

    return () => {
      unlistenButton.then((unlisten) => unlisten());
      unlistenStatus.then((unlisten) => unlisten());
      if (highlightTimeout.current) {
        window.clearTimeout(highlightTimeout.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buttons]);

  const statusColor: Record<ConnectionStatus, string> = {
    disconnected: "bg-neutral-500",
    connecting: "bg-amber-400 animate-pulse",
    connected: "bg-emerald-400",
    error: "bg-red-500",
  };

  return (
    <main className="flex h-screen w-screen flex-col bg-neutral-950 p-6 text-neutral-100">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stream Deck Host</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor[status]}`} />
            <span>{statusMessage}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={connectBluetooth}
          disabled={status === "connecting"}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "connected" ? "Reconnect Bluetooth" : "Connect Bluetooth"}
        </button>
      </header>

      <section className="flex-1">
        <div className="grid h-full grid-cols-5 grid-rows-3 gap-4">
          {buttons.map((config) => (
            <DeckButton
              key={config.id}
              config={config}
              active={activeButtonId === config.id}
              onPress={runMacro}
              onEdit={setEditTarget}
            />
          ))}
        </div>
      </section>

      {editTarget && (
        <EditModal
          config={editTarget}
          onSave={handleEditSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </main>
  );
}

export default App;
