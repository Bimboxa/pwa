import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedSlotId } from "../planningSlice";
import { setActiveWorkPackageId } from "Features/businessObjects/businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import usePlanningActions from "../hooks/usePlanningActions";
import usePlanningResources from "../hooks/usePlanningResources";
import usePlanningSlots from "../hooks/usePlanningSlots";
import useSlotPointerDrag from "../hooks/useSlotPointerDrag";

import PlanningGridHeader from "./PlanningGridHeader";
import PlanningResourceRow from "./PlanningResourceRow";
import PlanningSlotBlock from "./PlanningSlotBlock";

import {
  COL_WIDTH,
  HEADER_HEIGHT,
  LEFT_COL_WIDTH,
  ROW_HEIGHT,
} from "../constants/planningDefaults";
import {
  getNowStep,
  getPlanningColumnCount,
  getStepsPerDay,
  getTimeAxisColumns,
} from "../utils/planningTimeAxis";
import getSlotConsumedHours from "../utils/getSlotConsumedHours";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

const isEditableTarget = (el) => {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
};

// Gantt grid of a planning: resource rows × time steps, blocks per (resource,
// work package).
//
// Everything is driven by `pointerdown`, never by `click`: a click is emitted on
// the common ancestor of the pointerdown / pointerup targets, so after a drag it
// lands on the row band and used to create a phantom block.
//
// Press an empty band with a work package soloed in the left tab → 1-step block
// (when a block is selected, that first press only clears the selection). Press a
// block → selects it. A SELECTED block can be dragged (steps + resource row) and
// resized from its two handles (left = start, right = end). Escape clears the
// selection, Delete / Backspace removes the selected block.
export default function PlanningGrid({
  planning,
  workPackages,
  budgetByWorkPackageId,
  consumedByWorkPackageId,
}) {
  const dispatch = useDispatch();
  const rootRef = useRef(null);

  // data

  const { value: resources } = usePlanningResources({
    planningId: planning.id,
  });
  const { value: allSlots } = usePlanningSlots({ planningId: planning.id });
  const { createResource, createSlot, updateSlot, deleteSlot } =
    usePlanningActions();
  const selectedSlotId = useSelector((s) => s.planning.selectedSlotId);
  const playActive = useSelector((s) => s.planning.playActive);
  const playStep = useSelector((s) => s.planning.playStep);
  const activeWorkPackageId = useSelector(
    (s) => s.businessObjects.activeWorkPackageId
  );

  // play mode: keep the current column visible
  useEffect(() => {
    if (!playActive) return;
    const el = rootRef.current;
    if (!el) return;
    const left = LEFT_COL_WIDTH + playStep * COL_WIDTH;
    const visibleLeft = el.scrollLeft + LEFT_COL_WIDTH;
    const visibleRight = el.scrollLeft + el.clientWidth;
    if (left < visibleLeft || left + COL_WIDTH > visibleRight) {
      el.scrollLeft = Math.max(0, left - LEFT_COL_WIDTH - el.clientWidth / 3);
    }
  }, [playActive, playStep]);

  // Escape / Delete on the selected block. Capture phase + stopPropagation so
  // the shortcut does not depend on the grid holding the focus and the map
  // editor's window-level Delete handler (which would open the
  // delete-annotation dialog) never sees the event.
  useEffect(() => {
    if (!selectedSlotId) return;
    function onKey(e) {
      if (e.repeat) return;
      if (isEditableTarget(e.target)) return;
      // Let MUI dialogs / menus / popovers close themselves on Escape.
      if (e.target?.closest?.(".MuiModal-root")) return;
      if (e.key === "Escape") {
        dispatch(setSelectedSlotId(null));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        deleteSlot(selectedSlotId);
      } else return;
      e.preventDefault();
      e.stopPropagation();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedSlotId, dispatch, deleteSlot]);

  // helpers

  const workPackageById = useMemo(
    () => getItemsByKey(workPackages ?? [], "id"),
    [workPackages]
  );
  const slots = useMemo(
    () => allSlots.filter((s) => workPackageById[s.workPackageId]),
    [allSlots, workPackageById]
  );
  // "now" is not drawn anymore (no vertical line): it only widens the grid so
  // today stays reachable, and seeds the play mode's first step.
  const nowStep = useMemo(() => getNowStep(planning), [planning]);
  const columnCount = getPlanningColumnCount(
    planning,
    slots,
    playActive ? Math.max(nowStep ?? 0, playStep) : nowStep
  );
  const columns = useMemo(
    () => getTimeAxisColumns(planning, columnCount),
    [planning, columnCount]
  );
  const spd = getStepsPerDay(planning);
  const rowIndexByResourceId = useMemo(() => {
    const byId = {};
    resources.forEach((r, i) => {
      byId[r.id] = i;
    });
    return byId;
  }, [resources]);
  const slotsCountByResourceId = useMemo(() => {
    const byId = {};
    slots.forEach((s) => {
      byId[s.planningResourceId] = (byId[s.planningResourceId] ?? 0) + 1;
    });
    return byId;
  }, [slots]);

  // drag

  const { preview, startDrag } = useSlotPointerDrag({
    rowCount: resources.length,
    onCommit: async (slot, next) => {
      const resource = resources[next.rowIndex];
      await updateSlot(slot.id, {
        startStep: next.startStep,
        steps: next.steps,
        planningResourceId: resource?.id,
      });
    },
  });

  // slots per row (preview applied)
  const slotsByRowIndex = useMemo(() => {
    const rows = resources.map(() => []);
    slots.forEach((slot) => {
      const p = preview?.slotId === slot.id ? preview : null;
      const rowIndex = p
        ? p.rowIndex
        : rowIndexByResourceId[slot.planningResourceId];
      if (rowIndex == null || !rows[rowIndex]) return;
      rows[rowIndex].push({
        slot,
        startStep: p ? p.startStep : slot.startStep,
        steps: p ? p.steps : slot.steps,
        dragging: Boolean(p),
      });
    });
    return rows;
  }, [resources, slots, preview, rowIndexByResourceId]);

  // handlers

  function selectSlot(slot) {
    dispatch(setSelectedSlotId(slot.id));
    if (slot.workPackageId !== activeWorkPackageId) {
      dispatch(setActiveWorkPackageId(slot.workPackageId));
      dispatch(
        setSelectedItem({
          id: slot.workPackageId,
          type: "WORK_PACKAGE",
          listingId: planning?.listingId ?? null,
        })
      );
    }
  }

  async function handleBandPointerDown(e, resource) {
    // A press on an empty band first clears the block selection: a second press
    // creates a block.
    if (selectedSlotId) {
      dispatch(setSelectedSlotId(null));
      return;
    }
    if (!activeWorkPackageId || !workPackageById[activeWorkPackageId]) {
      dispatch(
        setToaster({
          message:
            "Sélectionnez une tâche dans le panneau de gauche pour la planifier.",
        })
      );
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const step = Math.max(0, Math.floor((e.clientX - rect.left) / COL_WIDTH));
    // Not auto-selected: consecutive presses keep creating blocks (a press on
    // an empty band deselects first, so auto-selecting would cost two presses
    // per block).
    await createSlot({
      planning,
      planningResourceId: resource.id,
      workPackageId: activeWorkPackageId,
      startStep: step,
      steps: 1,
    });
  }

  // render

  const bodyHeight = (resources.length + 1) * ROW_HEIGHT;
  const timeWidth = columnCount * COL_WIDTH;
  const gridBackground = `repeating-linear-gradient(90deg, transparent 0 ${
    COL_WIDTH - 1
  }px, rgba(0,0,0,0.12) ${COL_WIDTH - 1}px ${COL_WIDTH}px), repeating-linear-gradient(90deg, transparent 0 ${
    spd * COL_WIDTH - 1
  }px, rgba(0,0,0,0.35) ${spd * COL_WIDTH - 1}px ${spd * COL_WIDTH}px)`;
  const bandCursor = selectedSlotId
    ? "default"
    : activeWorkPackageId
      ? "cell"
      : "default";

  return (
    <Box
      ref={rootRef}
      tabIndex={0}
      onPointerDown={() => {
        if (selectedSlotId) dispatch(setSelectedSlotId(null));
      }}
      sx={{ flex: 1, minHeight: 0, overflow: "auto", outline: "none" }}
    >
      <Box
        sx={{
          position: "relative",
          width: LEFT_COL_WIDTH + timeWidth,
          minHeight: HEADER_HEIGHT + bodyHeight,
        }}
      >
        <PlanningGridHeader planning={planning} columns={columns} />

        {resources.map((resource, rowIndex) => (
          <Box key={resource.id} sx={{ display: "flex", height: ROW_HEIGHT }}>
            <PlanningResourceRow
              resource={resource}
              slotsCount={slotsCountByResourceId[resource.id] ?? 0}
              canMoveUp={rowIndex > 0}
              canMoveDown={rowIndex < resources.length - 1}
            />
            <Box
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                handleBandPointerDown(e, resource);
              }}
              sx={{
                position: "relative",
                width: timeWidth,
                minWidth: timeWidth,
                height: ROW_HEIGHT,
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundImage: gridBackground,
                cursor: bandCursor,
              }}
            >
              {slotsByRowIndex[rowIndex].map(
                ({ slot, startStep, steps, dragging }) => {
                  const wz = workPackageById[slot.workPackageId];
                  return (
                    <PlanningSlotBlock
                      key={slot.id}
                      slot={slot}
                      workPackage={wz}
                      startStep={startStep}
                      steps={steps}
                      hours={getSlotConsumedHours({ steps }, planning)}
                      consumed={
                        consumedByWorkPackageId?.[slot.workPackageId] ?? 0
                      }
                      budget={
                        budgetByWorkPackageId?.[slot.workPackageId] ?? null
                      }
                      selected={slot.id === selectedSlotId}
                      dragging={dragging}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        // Select first, drag second.
                        if (slot.id !== selectedSlotId) {
                          selectSlot(slot);
                          return;
                        }
                        startDrag(e, { slot, mode: "move", rowIndex });
                      }}
                      onPointerDownResizeStart={(e) =>
                        startDrag(e, { slot, mode: "resizeStart", rowIndex })
                      }
                      onPointerDownResizeEnd={(e) =>
                        startDrag(e, { slot, mode: "resizeEnd", rowIndex })
                      }
                      onDelete={(s) => deleteSlot(s.id)}
                    />
                  );
                }
              )}
            </Box>
          </Box>
        ))}

        {/* "+" row */}
        <Box sx={{ display: "flex", height: ROW_HEIGHT }}>
          <Box
            onClick={(e) => {
              e.stopPropagation();
              createResource({ planning });
            }}
            sx={{
              position: "sticky",
              left: 0,
              zIndex: 2,
              width: LEFT_COL_WIDTH,
              minWidth: LEFT_COL_WIDTH,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 1,
              bgcolor: "background.paper",
              borderRight: "1px solid",
              borderColor: "divider",
              color: "text.disabled",
              cursor: "pointer",
              "&:hover": { color: "text.secondary" },
            }}
          >
            <Add sx={{ fontSize: 18 }} />
            <Typography variant="body2" noWrap>
              Ajouter une ressource
            </Typography>
          </Box>
          <Box sx={{ width: timeWidth, minWidth: timeWidth }} />
        </Box>

        <Box
          sx={{
            position: "absolute",
            left: LEFT_COL_WIDTH,
            top: 0,
            width: timeWidth,
            height: HEADER_HEIGHT + bodyHeight,
            pointerEvents: "none",
          }}
        >
          {/* play mode: current step column */}
          {playActive && (
            <Box
              sx={{
                position: "absolute",
                left: playStep * COL_WIDTH,
                top: 0,
                width: COL_WIDTH,
                height: HEADER_HEIGHT + bodyHeight,
                bgcolor: "primary.main",
                opacity: 0.18,
                zIndex: 5,
                pointerEvents: "none",
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
