import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedSlotId } from "../planningSlice";
import { setSelectedWorkPackageId } from "Features/businessObjects/businessObjectsSlice";
import { clearSelection } from "Features/selection/selectionSlice";
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

// Gantt grid of a planning: resource rows × time steps, blocks per (resource,
// work package), red now line. Click an empty cell with a work package soloed in
// the left tab → 1-step block; drag to move (rows too) / resize (right
// edge); Delete on the selected block.
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
  const selectedWorkPackageId = useSelector(
    (s) => s.businessObjects.selectedWorkPackageId
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
    onClick: (slot) => {
      dispatch(clearSelection());
      dispatch(setSelectedSlotId(slot.id));
      if (slot.workPackageId !== selectedWorkPackageId)
        dispatch(setSelectedWorkPackageId(slot.workPackageId));
      rootRef.current?.focus();
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

  async function handleCellClick(e, resource) {
    if (!selectedWorkPackageId || !workPackageById[selectedWorkPackageId]) {
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
    const created = await createSlot({
      planning,
      planningResourceId: resource.id,
      workPackageId: selectedWorkPackageId,
      startStep: step,
      steps: 1,
    });
    dispatch(setSelectedSlotId(created.id));
    rootRef.current?.focus();
  }

  function handleKeyDown(e) {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if ((e.key === "Delete" || e.key === "Backspace") && selectedSlotId) {
      e.stopPropagation();
      e.preventDefault();
      deleteSlot(selectedSlotId);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      dispatch(setSelectedSlotId(null));
    }
  }

  // render

  const bodyHeight = (resources.length + 1) * ROW_HEIGHT;
  const timeWidth = columnCount * COL_WIDTH;
  const gridBackground = `repeating-linear-gradient(90deg, transparent 0 ${
    COL_WIDTH - 1
  }px, rgba(0,0,0,0.12) ${COL_WIDTH - 1}px ${COL_WIDTH}px), repeating-linear-gradient(90deg, transparent 0 ${
    spd * COL_WIDTH - 1
  }px, rgba(0,0,0,0.35) ${spd * COL_WIDTH - 1}px ${spd * COL_WIDTH}px)`;

  return (
    <Box
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => {
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
              onClick={(e) => {
                e.stopPropagation();
                handleCellClick(e, resource);
              }}
              sx={{
                position: "relative",
                width: timeWidth,
                minWidth: timeWidth,
                height: ROW_HEIGHT,
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundImage: gridBackground,
                cursor: selectedWorkPackageId ? "cell" : "default",
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
                      onPointerDownMove={(e) =>
                        startDrag(e, { slot, mode: "move", rowIndex })
                      }
                      onPointerDownResize={(e) =>
                        startDrag(e, { slot, mode: "resize", rowIndex })
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
