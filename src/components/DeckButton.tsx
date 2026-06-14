import type { DeckButtonConfig } from "../types";

interface DeckButtonProps {
  config: DeckButtonConfig;
  active: boolean;
  onPress: (config: DeckButtonConfig) => void;
}

function DeckButton({ config, active, onPress }: DeckButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onPress(config)}
      className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl border text-sm font-medium transition-all duration-150 ${
        active
          ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-95"
          : "border-neutral-700 bg-neutral-800 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-700"
      }`}
    >
      <span>{config.label}</span>
    </button>
  );
}

export default DeckButton;
