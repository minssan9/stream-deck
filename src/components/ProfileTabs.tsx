import type { Profile } from "../types";

interface ProfileTabsProps {
  profiles: Profile[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function ProfileTabs({ profiles, activeId, onSwitch, onAdd, onRename, onDelete }: ProfileTabsProps) {
  const handleRename = (profile: Profile) => {
    const name = window.prompt("Rename profile:", profile.name);
    if (name && name.trim() && name.trim() !== profile.name) {
      onRename(profile.id, name.trim());
    }
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {profiles.map((profile) => (
        <div key={profile.id} className="group relative flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => onSwitch(profile.id)}
            onDoubleClick={() => handleRename(profile)}
            title="Double-click to rename"
            className={`rounded-t-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              profile.id === activeId
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-300"
            }`}
          >
            {profile.name}
          </button>
          {profiles.length > 1 && (
            <button
              type="button"
              onClick={() => onDelete(profile.id)}
              title="Delete profile"
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-neutral-700 text-[10px] text-neutral-400 hover:bg-red-900 hover:text-red-300 group-hover:flex"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        title="New profile"
        className="ml-1 rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
      >
        +
      </button>
    </div>
  );
}

export default ProfileTabs;
