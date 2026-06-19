import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DeckButtonConfig } from "../types";
import DeckButton from "./DeckButton";

interface SortableItemProps {
  config: DeckButtonConfig;
  active: boolean;
  onPress: (config: DeckButtonConfig) => void;
  onEdit: (config: DeckButtonConfig) => void;
}

function SortableItem({ config, active, onPress, onEdit }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: config.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DeckButton config={config} active={active} onPress={onPress} onEdit={onEdit} />
    </div>
  );
}

interface SortableGridProps {
  buttons: DeckButtonConfig[];
  activeButtonId: string | null;
  onReorder: (buttons: DeckButtonConfig[]) => void;
  onPress: (config: DeckButtonConfig) => void;
  onEdit: (config: DeckButtonConfig) => void;
}

function SortableGrid({ buttons, activeButtonId, onReorder, onPress, onEdit }: SortableGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = buttons.findIndex((b) => b.id === active.id);
    const newIndex = buttons.findIndex((b) => b.id === over.id);
    onReorder(arrayMove(buttons, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={buttons.map((b) => b.id)} strategy={rectSortingStrategy}>
        <div className="grid h-full grid-cols-5 grid-rows-3 gap-4">
          {buttons.map((config) => (
            <SortableItem
              key={config.id}
              config={config}
              active={activeButtonId === config.id}
              onPress={onPress}
              onEdit={onEdit}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default SortableGrid;
