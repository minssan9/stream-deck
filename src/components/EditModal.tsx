import { useState } from "react";
import type { DeckButtonConfig, MacroAction } from "../types";

interface EditModalProps {
  config: DeckButtonConfig;
  onSave: (updated: DeckButtonConfig) => void;
  onClose: () => void;
}

function ActionEditor({
  action,
  index,
  onChange,
  onRemove,
}: {
  action: MacroAction;
  index: number;
  onChange: (index: number, updated: MacroAction) => void;
  onRemove: (index: number) => void;
}) {
  if (action.type === "KeyPress") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-neutral-400">KeyPress</span>
        <input
          className="flex-1 rounded bg-neutral-700 px-2 py-1 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-blue-500"
          value={action.keys.join(", ")}
          placeholder="Control, Shift, c"
          onChange={(e) =>
            onChange(index, {
              type: "KeyPress",
              keys: e.currentTarget.value.split(",").map((k) => k.trim()).filter(Boolean),
            })
          }
        />
        <RemoveButton onRemove={() => onRemove(index)} />
      </div>
    );
  }

  if (action.type === "Delay") {
    return (
      <div className="flex items-center gap-2">
        <span className="w-20 shrink-0 text-xs text-neutral-400">Delay (ms)</span>
        <input
          type="number"
          min={0}
          className="flex-1 rounded bg-neutral-700 px-2 py-1 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-blue-500"
          value={action.ms}
          onChange={(e) =>
            onChange(index, { type: "Delay", ms: Math.max(0, Number(e.currentTarget.value)) })
          }
        />
        <RemoveButton onRemove={() => onRemove(index)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-neutral-400">Open App</span>
      <input
        className="flex-1 rounded bg-neutral-700 px-2 py-1 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-blue-500"
        value={action.path}
        placeholder="/usr/bin/vim or notepad.exe"
        onChange={(e) => onChange(index, { type: "OpenApp", path: e.currentTarget.value })}
      />
      <RemoveButton onRemove={() => onRemove(index)} />
    </div>
  );
}

function RemoveButton({ onRemove }: { onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-red-400"
      title="Remove"
    >
      ✕
    </button>
  );
}

function EditModal({ config, onSave, onClose }: EditModalProps) {
  const [label, setLabel] = useState(config.label);
  const [actions, setActions] = useState<MacroAction[]>([...config.macro]);

  const updateAction = (index: number, updated: MacroAction) => {
    setActions((prev) => prev.map((a, i) => (i === index ? updated : a)));
  };

  const removeAction = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const addAction = (type: MacroAction["type"]) => {
    const defaults: Record<MacroAction["type"], MacroAction> = {
      KeyPress: { type: "KeyPress", keys: [] },
      Delay: { type: "Delay", ms: 200 },
      OpenApp: { type: "OpenApp", path: "" },
    };
    setActions((prev) => [...prev, defaults[type]]);
  };

  const handleSave = () => {
    onSave({ ...config, label: label.trim() || config.label, macro: actions });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Edit {config.id}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs text-neutral-400">Label</label>
          <input
            className="w-full rounded bg-neutral-800 px-3 py-2 text-sm text-neutral-100 outline-none focus:ring-1 focus:ring-blue-500"
            value={label}
            onChange={(e) => setLabel(e.currentTarget.value)}
          />
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-xs text-neutral-400">Macro steps</label>
          <div className="space-y-2">
            {actions.length === 0 && (
              <p className="text-xs text-neutral-500">No steps. Add one below.</p>
            )}
            {actions.map((action, i) => (
              <ActionEditor
                key={i}
                action={action}
                index={i}
                onChange={updateAction}
                onRemove={removeAction}
              />
            ))}
          </div>
        </div>

        <div className="mb-5 flex gap-2">
          {(["KeyPress", "Delay", "OpenApp"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => addAction(type)}
              className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-300 hover:border-neutral-400 hover:bg-neutral-800"
            >
              + {type}
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditModal;
