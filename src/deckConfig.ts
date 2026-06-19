import type { DeckButtonConfig, Profile, ProfileStore } from "./types";

export const DEFAULT_BUTTONS: DeckButtonConfig[] = Array.from({ length: 15 }, (_, i) => {
  const n = i + 1;
  return {
    id: `btn_${n}`,
    label: `Button ${n}`,
    macro: [
      { type: "Delay", ms: 0 },
      { type: "KeyPress", keys: ["Control", "Shift", String(((n - 1) % 9) + 1)] },
    ],
  };
});

export const DEFAULT_PROFILE: Profile = {
  id: "default",
  name: "Default",
  buttons: DEFAULT_BUTTONS,
};

export const DEFAULT_STORE: ProfileStore = {
  active_id: "default",
  profiles: [DEFAULT_PROFILE],
};
