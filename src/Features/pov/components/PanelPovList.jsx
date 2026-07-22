import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { selectSelectedItem } from "Features/selection/selectionSlice";
import { setPovFramingActive, setPovViewFreeze } from "../povSlice";

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
import ButtonGeneratePovVideo from "./ButtonGeneratePovVideo";
import usePovs from "../hooks/usePovs";
import useUpdatePov from "../hooks/useUpdatePov";
import useRestorePov from "../hooks/useRestorePov";
import useEnterPovFraming from "../hooks/useEnterPovFraming";
import useExitPovFraming from "../hooks/useExitPovFraming";

// POV viewer left drawer: sortable list of saved views (fractional index,
// same dnd mechanics as the portfolio pages tree). Views are created via
// the floating ButtonCreatePovView / ButtonSavePov at the bottom of the
// viewer.
export default function PanelPovList() {
  const dispatch = useDispatch();

  // strings

  const emptyS = "Aucun point de vue. Cadrez la vue puis enregistrez-la.";

  // data

  const povs = usePovs() ?? [];
  const updatePov = useUpdatePov();
  const restorePov = useRestorePov();
  const enterFraming = useEnterPovFraming();
  const exitFraming = useExitPovFraming();
  const selectedItem = useSelector(selectSelectedItem);

  // helpers

  const povIds = povs.map((p) => p.id);
  const selectedPovId = selectedItem?.type === "POV" ? selectedItem.id : null;

  // effect - the module opens in "browse" mode: no capture frame, no selected
  // view, PopperMapListings visible in SELECT mode so the annotations can be
  // filtered before framing. This panel is only mounted under the POV module
  // (SectionViewer), so mount/unmount == entering/leaving the module.

  const exitFramingRef = useRef(exitFraming);
  exitFramingRef.current = exitFraming;

  useEffect(() => {
    exitFramingRef.current();
    return () => {
      dispatch(setPovFramingActive(false));
    };
  }, [dispatch]);

  // effect - deselecting a view (or selecting another item) unfreezes the
  // content. Only `selectedPovId` is watched on purpose: the freeze must not
  // be cleared when it is set without a selection change (video generation
  // applies each POV's scene without touching the selection).
  useEffect(() => {
    if (!selectedPovId) dispatch(setPovViewFreeze(null));
  }, [selectedPovId, dispatch]);

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
      const a =
        newIndex + 1 < povs.length ? povs[newIndex + 1]?.sortIndex : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b = newIndex > 0 ? povs[newIndex - 1]?.sortIndex : null;
      const a = povs[newIndex]?.sortIndex ?? null;
      newSortIndex = generateKeyBetween(b, a);
    }

    await updatePov(active.id, { sortIndex: newSortIndex });
  }

  // Selecting only: the frame is armed on the view CURRENTLY displayed, so
  // "Mettre à jour la vue" can refresh it with the present camera / filters.
  function handleItemClick(pov) {
    enterFraming(pov);
  }

  // "Appliquer la vue": same selection, plus the saved camera + filters — the
  // camera flies there from the displayed view.
  async function handleItemApply(pov) {
    enterFraming(pov);
    await restorePov(pov, { animate: true });
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
                onApply={() => handleItemApply(pov)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>

      <ButtonGeneratePovVideo />
    </Box>
  );
}
