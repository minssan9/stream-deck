import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import DeckButton from "./components/DeckButton";
import { DEFAULT_BUTTONS } from "./deckConfig";
import type { ButtonEvent, DeckButtonConfig } from "./types";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const ACTIVE_HIGHLIGHT_MS = 400;

function App() {
  const [buttons] = useState<DeckButtonConfig[]>(DEFAULT_BUTTONS);
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);
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

  const connectBluetooth = async () => {
    setStatus("connecting");
    setStatusMessage("Scanning for device...");
    try {
      const result = await invoke<string>("start_ble_server");
      setStatus("connected");
      setStatusMessage(result);
    } catch (err) {
      setStatus("error");
      setStatusMessage(String(err));
    }
  };

  useEffect(() => {
    const unlistenPromise = listen<ButtonEvent>("ble-button-event", (event) => {
      const { button_id } = event.payload;
      const config = buttons.find((b) => b.id === button_id);
      if (config) {
        void runMacro(config);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
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
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
