import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItem,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Typography } from "@mui/material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";

import PovListItem from "./PovListItem";
import usePovs from "../hooks/usePovs";
import useUpdatePov from "../hooks/useUpdatePov";
import useRestorePov from "../hooks/useRestorePov";

// POV viewer left drawer: sortable list of saved views (fractional index,
// same dnd mechanics as the portfolio pages tree). Views are created via
// the floating ButtonSavePov at the bottom of the viewer.
export default function PanelPovList() {
  const dispatch = useDispatch();

  // strings

  const emptyS = "Aucun point de vue. Cadrez la vue puis enregistrez-la.";

  // data

  const povs = usePovs() ?? [];
  const updatePov = useUpdatePov();
  const restorePov = useRestorePov();
  const selectedItem = useSelector(selectSelectedItem);

  // helpers

  const povIds = povs.map((p) => p.id);
  const selectedPovId =
    selectedItem?.type === "POV" ? selectedItem.id : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // handlers

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = povIds.indexOf(active.id);
    const newIndex = povIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    let newSortIndex;
    if (oldIndex < newIndex) {
      const b = povs[newIndex]?.sortIndex ?? null;
      const a = newIndex + 1 < povs.length ? povs[newIndex + 1]?.sortIndex : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b = newIndex > 0 ? povs[newIndex - 1]?.sortIndex : null;
      const a = povs[newIndex]?.sortIndex ?? null;
      newSortIndex = generateKeyBetween(b, a);
    }

    await updatePov(active.id, { sortIndex: newSortIndex });
  }

  async function handleItemClick(pov) {
    dispatch(setSelectedItem({ id: pov.id, type: "POV" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
    await restorePov(pov);
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1,
          pt: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        {povs.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
            {emptyS}
          </Typography>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={povIds}
            strategy={verticalListSortingStrategy}
          >
            {povs.map((pov) => (
              <PovListItem
                key={pov.id}
                pov={pov}
                isSelected={pov.id === selectedPovId}
                onClick={() => handleItemClick(pov)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>
    </Box>
  );
}
