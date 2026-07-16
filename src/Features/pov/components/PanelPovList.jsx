import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItem,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Button, Typography } from "@mui/material";
import { PhotoCamera } from "@mui/icons-material";

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
import useCreatePov from "../hooks/useCreatePov";
import useUpdatePov from "../hooks/useUpdatePov";
import useRestorePov from "../hooks/useRestorePov";

// POV viewer left drawer: sortable list of saved views (fractional index,
// same dnd mechanics as the portfolio pages tree) + "Enregistrer la vue".
export default function PanelPovList() {
  const dispatch = useDispatch();

  // strings

  const title = "Points de vue";
  const saveS = "Enregistrer la vue";
  const emptyS = "Aucun point de vue. Cadrez la vue puis enregistrez-la.";

  // data

  const povs = usePovs() ?? [];
  const createPov = useCreatePov();
  const updatePov = useUpdatePov();
  const restorePov = useRestorePov();
  const selectedItem = useSelector(selectSelectedItem);

  // state

  const [creating, setCreating] = useState(false);

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

  async function handleCreateClick() {
    if (creating) return;
    setCreating(true);
    try {
      await createPov({
        lastSortIndex: povs[povs.length - 1]?.sortIndex ?? null,
      });
    } finally {
      setCreating(false);
    }
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ p: 1, pl: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
          {title}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: 1,
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

      <Box sx={{ p: 1 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<PhotoCamera />}
          onClick={handleCreateClick}
          disabled={creating}
          sx={{ textTransform: "none" }}
        >
          {saveS}
        </Button>
      </Box>
    </Box>
  );
}
