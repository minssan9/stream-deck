import type { DeckButtonConfig } from "../types";

interface DeckButtonProps {
  config: DeckButtonConfig;
  active: boolean;
  onPress: (config: DeckButtonConfig) => void;
  onEdit: (config: DeckButtonConfig) => void;
}

function DeckButton({ config, active, onPress, onEdit }: DeckButtonProps) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onPress(config)}
        className={`flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium transition-all duration-150 ${
          active
            ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-95"
            : "border-neutral-700 bg-neutral-800 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-700"
        }`}
      >
        {config.icon && (
          config.icon.startsWith("data:") ? (
            <img src={config.icon} alt="" className="h-7 w-7 rounded object-cover" />
          ) : (
            <span className="text-2xl leading-none">{config.icon}</span>
          )
        )}
        <span className="truncate px-1 text-xs">{config.label}</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(config); }}
        title="Edit button"
        className="absolute right-1 top-1 hidden rounded p-0.5 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-200 group-hover:flex"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
  );
}

export default DeckButton;
