import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import EditModal from "./components/EditModal";
import ProfileTabs from "./components/ProfileTabs";
import SortableGrid from "./components/SortableGrid";
import { DEFAULT_STORE } from "./deckConfig";
import type {
  BleConnectionStatusEvent,
  ButtonEvent,
  DeckButtonConfig,
  Profile,
  ProfileStore,
} from "./types";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

const ACTIVE_HIGHLIGHT_MS = 400;

function App() {
  const [store, setStore] = useState<ProfileStore>(DEFAULT_STORE);
  const [activeButtonId, setActiveButtonId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<DeckButtonConfig | null>(null);
  const [bleStatus, setBleStatus] = useState<ConnectionStatus>("disconnected");
  const [bleMessage, setBleMessage] = useState("Not connected");
  const highlightTimeout = useRef<number | undefined>(undefined);

  // ── derived state ───────────────────────────────────────────────────────────

  const activeProfile: Profile =
    store.profiles.find((p) => p.id === store.active_id) ?? store.profiles[0];

  // ── helpers ─────────────────────────────────────────────────────────────────

  const saveStore = async (next: ProfileStore) => {
    setStore(next);
    try {
      await invoke("save_profiles", { store: next });
    } catch (err) {
      console.error("Failed to save profiles", err);
    }
  };

  const updateActiveButtons = (buttons: DeckButtonConfig[]) => {
    const next: ProfileStore = {
      ...store,
      profiles: store.profiles.map((p) =>
        p.id === activeProfile.id ? { ...p, buttons } : p,
      ),
    };
    void saveStore(next);
  };

  const highlightButton = (id: string) => {
    setActiveButtonId(id);
    if (highlightTimeout.current) window.clearTimeout(highlightTimeout.current);
    highlightTimeout.current = window.setTimeout(() => setActiveButtonId(null), ACTIVE_HIGHLIGHT_MS);
  };

  const runMacro = async (config: DeckButtonConfig) => {
    highlightButton(config.id);
    try {
      await invoke("execute_macro", { payload: JSON.stringify(config.macro) });
    } catch (err) {
      console.error("Failed to execute macro", err);
    }
  };

  // ── profile actions ─────────────────────────────────────────────────────────

  const handleSwitch = (id: string) => {
    void saveStore({ ...store, active_id: id });
  };

  const handleAdd = () => {
    const name = window.prompt("Profile name:", `Profile ${store.profiles.length + 1}`);
    if (!name?.trim()) return;
    const id = `p_${Date.now()}`;
    const newProfile: Profile = {
      id,
      name: name.trim(),
      buttons: Array.from({ length: 15 }, (_, i) => ({
        id: `btn_${i + 1}`,
        label: `Button ${i + 1}`,
        macro: [],
      })),
    };
    void saveStore({ active_id: id, profiles: [...store.profiles, newProfile] });
  };

  const handleRename = (id: string, name: string) => {
    const next: ProfileStore = {
      ...store,
      profiles: store.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
    };
    void saveStore(next);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Delete this profile?")) return;
    const remaining = store.profiles.filter((p) => p.id !== id);
    void saveStore({
      active_id: remaining[0].id,
      profiles: remaining,
    });
  };

  const handleEditSave = (updated: DeckButtonConfig) => {
    updateActiveButtons(
      activeProfile.buttons.map((b) => (b.id === updated.id ? updated : b)),
    );
  };

  const handleReorder = (buttons: DeckButtonConfig[]) => {
    updateActiveButtons(buttons);
  };

  // ── lifecycle ───────────────────────────────────────────────────────────────

  useEffect(() => {
    invoke<ProfileStore>("load_profiles")
      .then((loaded) => setStore(loaded))
      .catch(() => { /* first run — keep DEFAULT_STORE */ });
  }, []);

  useEffect(() => {
    const unlistenButton = listen<ButtonEvent>("ble-button-event", (event) => {
      const config = activeProfile.buttons.find((b) => b.id === event.payload.button_id);
      if (config) void runMacro(config);
    });

    const unlistenStatus = listen<BleConnectionStatusEvent>("ble-connection-status", (event) => {
      const { status, message } = event.payload;
      const map: Record<typeof status, ConnectionStatus> = {
        scanning: "connecting",
        connected: "connected",
        disconnected: "disconnected",
        error: "error",
      };
      setBleStatus(map[status]);
      setBleMessage(message);
    });

    return () => {
      unlistenButton.then((u) => u());
      unlistenStatus.then((u) => u());
      if (highlightTimeout.current) window.clearTimeout(highlightTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile.buttons]);

  const connectBluetooth = async () => {
    setBleStatus("connecting");
    setBleMessage("Starting BLE server...");
    try {
      await invoke<string>("start_ble_server");
    } catch (err) {
      setBleStatus("error");
      setBleMessage(String(err));
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  const statusColor: Record<ConnectionStatus, string> = {
    disconnected: "bg-neutral-500",
    connecting: "bg-amber-400 animate-pulse",
    connected: "bg-emerald-400",
    error: "bg-red-500",
  };

  return (
    <main className="flex h-screen w-screen flex-col bg-neutral-950 p-6 text-neutral-100">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stream Deck Host</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusColor[bleStatus]}`} />
            <span>{bleMessage}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={connectBluetooth}
          disabled={bleStatus === "connecting"}
          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {bleStatus === "connected" ? "Reconnect Bluetooth" : "Connect Bluetooth"}
        </button>
      </header>

      <ProfileTabs
        profiles={store.profiles}
        activeId={activeProfile.id}
        onSwitch={handleSwitch}
        onAdd={handleAdd}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      <div className="mt-2 flex-1">
        <SortableGrid
          buttons={activeProfile.buttons}
          activeButtonId={activeButtonId}
          onReorder={handleReorder}
          onPress={runMacro}
          onEdit={setEditTarget}
        />
      </div>

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
