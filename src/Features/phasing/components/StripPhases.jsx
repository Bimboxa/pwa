import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setActivePhasingListingId,
  setPhaseStepEditMode,
  setNewAnnotationPeriodMode,
  togglePhaseSelection,
  triggerRelsPhaseAnnotationUpdate,
} from "../phasingSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import {
  Box,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Add, Edit } from "@mui/icons-material";

import useShowCommandsToolbar from "Features/commandsToolbar/hooks/useShowCommandsToolbar";
import usePhasingListing from "../hooks/usePhasingListing";
import usePhases from "../hooks/usePhases";
import useRelsPhaseAnnotation from "../hooks/useRelsPhaseAnnotation";

import DialogCreatePhase from "./DialogCreatePhase";
import DialogBusinessObjectForm from "Features/businessObjects/components/DialogBusinessObjectForm";

import { getSelectedAnnotationIds } from "Features/annotations/utils/annotationLabelSelection";
import { getBusinessObjectTypeKeyFromModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";
import { PHASING_TYPE_KEY } from "../constants";
import groupPhaseRelsByAnnotationId from "../utils/groupPhaseRelsByAnnotationId";
import resolveAnnotationPhaseIndexes from "../utils/resolveAnnotationPhaseIndexes";
import getPhaseIndexesAfterClick from "../utils/getPhaseIndexesAfterClick";
import setAnnotationsPhasesService from "../services/setAnnotationsPhasesService";
// registers the "assign the new annotations to the selected phases" hook
import "../services/requestPhaseAssignOnCreate";

const STRIP_HEIGHT = 40;
const STEP_HEIGHT = 26;
const STEP_MIN_WIDTH = 52;
// depth of the arrow tip / notch of a block, and thickness of its outline
const ARROW = 9;
const OUTLINE = 1.5;

// Arrow block: flat left side for the first one, notched for the others so
// each block fits in the tip of the previous one.
const getArrowClipPath = (isFirst) =>
  isFirst
    ? `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%)`
    : `polygon(0 0, calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%, 0 100%, ${ARROW}px 50%)`;

// One arrow block of the strip. `color` is its outline; `fill` its inside
// (the outline is the block itself, the inside a slightly smaller layer with
// the same shape).
function ArrowBlock({
  isFirst,
  color,
  fill,
  textColor,
  dashed = false,
  children,
  ...props
}) {
  const clipPath = getArrowClipPath(isFirst);
  return (
    <Box
      component="button"
      type="button"
      {...props}
      sx={{
        position: "relative",
        flexShrink: 0,
        minWidth: STEP_MIN_WIDTH,
        height: STEP_HEIGHT,
        // the notch of a block fits the tip of the previous one with no gap:
        // the two slanted outlines overlap, so the joint is a single line
        ml: isFirst ? 0 : `${-(ARROW + OUTLINE * 2)}px`,
        pl: isFirst ? 0.5 : `${ARROW}px`,
        pr: `${ARROW}px`,
        border: 0,
        bgcolor: color,
        clipPath,
        opacity: dashed ? 0.6 : 1,
        font: "inherit",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        color: textColor,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: `${OUTLINE}px`,
          // wider side margins: the slanted edges need more than the flat ones
          left: `${OUTLINE * 2}px`,
          right: `${OUTLINE * 2}px`,
          background: fill,
          clipPath,
        },
        "& > *": { position: "relative" },
      }}
    >
      <span>{children}</span>
    </Box>
  );
}

// Horizontal strip of the phases (numbered 1..N arrow blocks fitting into each
// other, white by default) of the scope's
// PHASING listing, in flow above the 2D / 3D editors (SectionViewer).
// - No annotation selected: the blocks in the primary color are the
//   DISPLAYED phases (phasing.selectedPhaseIds — none selected = all
//   displayed; click = that phase only, again = everything, Ctrl / Shift
//   click = several). New annotations are assigned to the selected ones.
// - Annotation(s) selected: the blocks in the secondary color are the
//   phases they are present in (half tone = some of them only). Hovering a step previews the
//   new period, the click writes it for the whole selection in one batch
//   (one undo step). With the "step by step" toggle on, the click toggles
//   that single step instead.
export default function StripPhases() {
  const dispatch = useDispatch();

  // strings

  const emptyS = "Aucune phase";
  const addS = "Ajouter une phase";
  const stepEditS = "Modification phase par phase";
  const displayedS = "Phase affichée";
  const errorS = "Les phases n'ont pas pu être modifiées.";
  const newAnnotationS = "Nouvelle annotation";
  const allPhasesS = "Toutes les phases";
  const bySelectionS = "Phases définies par la sélection";
  const renameS = "Renommer la phase";

  // data

  const theme = useTheme();
  const show = useShowCommandsToolbar();
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const moduleListingId = useSelector(
    (s) => s.businessObjects.selectedListingId
  );
  const selectedPhaseIds = useSelector((s) => s.phasing.selectedPhaseIds);
  const stepEditMode = useSelector((s) => s.phasing.stepEditMode);
  const newAnnotationPeriodMode = useSelector(
    (s) => s.phasing.newAnnotationPeriodMode
  );
  const selectedItems = useSelector(selectSelectedItems);

  const { listing, listings } = usePhasingListing();
  const listingId = show ? (listing?.id ?? null) : null;
  const phases = usePhases(listingId);
  const { value: rels } = useRelsPhaseAnnotation({ listingId });

  // state

  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);
  // phase being renamed from the chip of the selected phase
  const [renamedPhase, setRenamedPhase] = useState(null);

  // helpers — selected annotations and the phases they are present in

  const annotationIds = useMemo(
    () => getSelectedAnnotationIds(selectedItems),
    [selectedItems]
  );
  const hasAnnotations = annotationIds.length > 0;

  const indexesByAnnotationId = useMemo(() => {
    const result = new Map();
    if (!hasAnnotations || !phases.length) return result;
    const relsByAnnotationId = groupPhaseRelsByAnnotationId(rels);
    annotationIds.forEach((id) => {
      result.set(
        id,
        resolveAnnotationPhaseIndexes(relsByAnnotationId.get(id), phases)
      );
    });
    return result;
  }, [hasAnnotations, annotationIds, rels, phases]);

  // per step: number of selected annotations present in it
  const countByIndex = useMemo(() => {
    const counts = phases.map(() => 0);
    indexesByAnnotationId.forEach((indexes) => {
      indexes.forEach((index) => {
        if (index < counts.length) counts[index] += 1;
      });
    });
    return counts;
  }, [indexesByAnnotationId, phases]);

  // period of the whole selection: the steps at least one annotation is in
  const unionIndexes = useMemo(() => {
    const union = new Set();
    countByIndex.forEach((count, index) => {
      if (count > 0) union.add(index);
    });
    return union;
  }, [countByIndex]);

  // what a click on `index` writes: annotationId -> Set of indexes
  function getTargetAfterClick(index) {
    const target = new Map();
    if (stepEditMode) {
      // toggle that single step: on for all unless all are already in it
      const allIn = countByIndex[index] === annotationIds.length;
      indexesByAnnotationId.forEach((indexes, id) => {
        const next = new Set(indexes);
        if (allIn) next.delete(index);
        else next.add(index);
        // an annotation is always in at least one phase
        if (next.size > 0) target.set(id, next);
      });
      return target;
    }
    const next = getPhaseIndexesAfterClick(unionIndexes, index);
    annotationIds.forEach((id) => target.set(id, next));
    return target;
  }

  // hover preview (annotations selected): steps the selection would be in
  const previewCountByIndex = useMemo(() => {
    if (!hasAnnotations || hoveredIndex == null) return null;
    const counts = phases.map(() => 0);
    getTargetAfterClick(hoveredIndex).forEach((indexes) => {
      indexes.forEach((index) => {
        if (index < counts.length) counts[index] += 1;
      });
    });
    return counts;
  }, [hasAnnotations, hoveredIndex, stepEditMode, indexesByAnnotationId]);

  // effects — the listing picked in the Phasage module drives the strip

  const isPhasingModule =
    getBusinessObjectTypeKeyFromModuleKey(viewerKey) === PHASING_TYPE_KEY;
  const moduleListingIsPhasing = Boolean(
    isPhasingModule && listings?.some((l) => l.id === moduleListingId)
  );
  useEffect(() => {
    if (moduleListingIsPhasing)
      dispatch(setActivePhasingListingId(moduleListingId));
  }, [moduleListingIsPhasing, moduleListingId, dispatch]);

  // handlers

  async function handleStepClick(e, phase, index) {
    if (!hasAnnotations) {
      const additive = Boolean(e.ctrlKey || e.metaKey || e.shiftKey);
      dispatch(togglePhaseSelection({ id: phase.id, additive }));
      return;
    }
    try {
      await setAnnotationsPhasesService({
        listing,
        phases,
        indexesByAnnotationId: getTargetAfterClick(index),
      });
      dispatch(triggerRelsPhaseAnnotationUpdate());
    } catch (error) {
      console.error("[StripPhases]", error);
      dispatch(
        setToaster({ message: error?.message || errorS, isError: true })
      );
    }
  }

  // render

  if (!show || !listing) return null;

  const total = annotationIds.length;
  // Dessin module: block telling which phases the next drawn annotation gets
  const showNewAnnotation = viewerKey === "MAP";
  const selectedPhaseNumbers = phases
    .map((phase, index) =>
      selectedPhaseIds.includes(phase.id) ? index + 1 : null
    )
    .filter(Boolean);
  const singlePhaseNumber =
    selectedPhaseNumbers.length === 1 ? selectedPhaseNumbers[0] : null;
  // ONE selected phase: its name shows next to the arrows, with a rename
  // button
  const singlePhase =
    singlePhaseNumber != null ? phases[singlePhaseNumber - 1] : null;
  const counts = previewCountByIndex ?? countByIndex;
  const paper = theme.palette.background.paper;
  // outline of the white (idle) blocks
  const idleColor = theme.palette.text.secondary;
  // selected (displayed) phase / period of the selected annotations
  const activeColor = theme.palette.primary.main;
  const periodColor = theme.palette.secondary.main;

  return (
    <Box
      sx={{
        flexShrink: 0,
        height: STRIP_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 1,
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Typography
        variant="caption"
        noWrap
        sx={{ color: "text.secondary", flexShrink: 1, minWidth: 0 }}
      >
        {listing.name}
      </Typography>

      <Box
        onMouseLeave={() => setHoveredIndex(null)}
        sx={{
          display: "flex",
          alignItems: "center",
          minWidth: 0,
          overflowX: "auto",
        }}
      >
        {phases.map((phase, index) => {
          // Blocks are white with a thin outline. Colored ones:
          // - no annotation selected: the selected (displayed) phases take
          //   the primary color;
          // - annotations selected: the phases of their period take the
          //   secondary color (half tone when only some of the
          //   annotations are in the phase).
          const count = hasAnnotations ? counts[index] : 0;
          const isActive =
            !hasAnnotations && selectedPhaseIds.includes(phase.id);
          const isFull = hasAnnotations && count === total;
          const isPartial = hasAnnotations && count > 0 && count < total;
          // block the hovered click would change
          const isChanging =
            previewCountByIndex != null &&
            previewCountByIndex[index] !== countByIndex[index];
          const color = isActive
            ? activeColor
            : isFull || isPartial
              ? periodColor
              : idleColor;
          const fill = isActive
            ? activeColor
            : isFull
              ? periodColor
              : isPartial
                ? `linear-gradient(${alpha(periodColor, 0.45)}, ${alpha(periodColor, 0.45)}), ${paper}`
                : paper;
          const textColor =
            isActive || isFull
              ? theme.palette.getContrastText(fill)
              : theme.palette.text.primary;
          const tooltipS = isActive
            ? `${phase.label} — ${displayedS.toLowerCase()}`
            : phase.label;
          return (
            <Tooltip key={phase.id} title={tooltipS}>
              <ArrowBlock
                isFirst={index === 0}
                color={color}
                fill={fill}
                textColor={textColor}
                dashed={isChanging}
                onClick={(e) => handleStepClick(e, phase, index)}
                onMouseEnter={() => setHoveredIndex(index)}
              >
                {index + 1}
              </ArrowBlock>
            </Tooltip>
          );
        })}
        {/* last block of the chain: add a phase */}
        <Tooltip title={phases.length === 0 ? `${emptyS} — ${addS}` : addS}>
          <ArrowBlock
            isFirst={phases.length === 0}
            color={idleColor}
            fill={paper}
            textColor={theme.palette.text.primary}
            onClick={() => setOpenCreate(true)}
            onMouseEnter={() => setHoveredIndex(null)}
          >
            <Add sx={{ fontSize: 16, display: "block" }} />
          </ArrowBlock>
        </Tooltip>
      </Box>

      {singlePhase && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
            flexShrink: 1,
          }}
        >
          <Chip
            size="small"
            color="primary"
            label={singlePhase.label}
            sx={{ maxWidth: 220, fontWeight: 600 }}
          />
          <Tooltip title={renameS}>
            <IconButton
              size="small"
              onClick={() => setRenamedPhase(singlePhase)}
              sx={{ p: 0.5 }}
            >
              <Edit sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={stepEditMode}
            onChange={(e) => dispatch(setPhaseStepEditMode(e.target.checked))}
            sx={{ p: 0.5 }}
          />
        }
        label={
          <Typography variant="caption" noWrap>
            {stepEditS}
          </Typography>
        }
        sx={{ m: 0, flexShrink: 0 }}
      />

      {showNewAnnotation && (
        <>
          <Divider orientation="vertical" flexItem sx={{ my: 1 }} />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexShrink: 0,
            }}
          >
            <Typography
              variant="caption"
              noWrap
              sx={{ color: "text.secondary" }}
            >
              {newAnnotationS}
            </Typography>
            {singlePhaseNumber != null ? (
              <ToggleButtonGroup
                exclusive
                size="small"
                value={newAnnotationPeriodMode}
                onChange={(e, value) => {
                  if (value) dispatch(setNewAnnotationPeriodMode(value));
                }}
                sx={{
                  "& .MuiToggleButton-root": {
                    py: 0,
                    px: 1,
                    height: STEP_HEIGHT,
                    fontSize: 12,
                    textTransform: "none",
                    whiteSpace: "nowrap",
                  },
                }}
              >
                <ToggleButton value="ONLY">
                  {`Phase ${singlePhaseNumber} uniquement`}
                </ToggleButton>
                <ToggleButton value="FROM">
                  {`Phase ${singlePhaseNumber} et après`}
                </ToggleButton>
              </ToggleButtonGroup>
            ) : (
              <Typography variant="caption" noWrap>
                {selectedPhaseNumbers.length > 1 ? bySelectionS : allPhasesS}
              </Typography>
            )}
          </Box>
        </>
      )}

      {renamedPhase && (
        <DialogBusinessObjectForm
          open
          listing={listing}
          businessObject={renamedPhase}
          onClose={() => setRenamedPhase(null)}
        />
      )}
      <DialogCreatePhase
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        listing={listing}
        phases={phases}
      />
    </Box>
  );
}
