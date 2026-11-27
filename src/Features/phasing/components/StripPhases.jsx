import { Fragment, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setActivePhasingListingId,
  setSelectedPhaseIds,
  setHighlightNewAnnotations,
  togglePhaseSelection,
  triggerRelsPhaseAnnotationUpdate,
} from "../phasingSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { selectDisabledModuleKeys } from "Features/scopeConfig/utils/scopeConfigSelectors";

import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { ThemeProvider, lighten, useTheme } from "@mui/material/styles";
import { Add, ChevronLeft, ChevronRight } from "@mui/icons-material";

import useShowCommandsToolbar from "Features/commandsToolbar/hooks/useShowCommandsToolbar";
import usePhasingListing from "../hooks/usePhasingListing";
import usePhases from "../hooks/usePhases";
import useRelsPhaseAnnotation from "../hooks/useRelsPhaseAnnotation";

import DialogCreatePhase from "./DialogCreatePhase";
import FieldPhaseNameInline from "./FieldPhaseNameInline";
import SelectorPhasingListing from "./SelectorPhasingListing";
import DialogCreateBusinessObjectListing from "Features/businessObjects/components/DialogCreateBusinessObjectListing";
import useBusinessObjectsModuleLabel from "Features/businessObjects/hooks/useBusinessObjectsModuleLabel";

import { getSelectedAnnotationIds } from "Features/annotations/utils/annotationLabelSelection";
import {
  getBusinessObjectTypeKeyFromModuleKey,
  getBusinessObjectsModuleKey,
} from "Features/businessObjects/utils/businessObjectModuleKeys";
import appTheme from "Styles/theme";
import phasingDarkTheme from "../phasingDarkTheme";
import { PHASING_TYPE_KEY } from "../constants";
import groupPhaseRelsByAnnotationId from "../utils/groupPhaseRelsByAnnotationId";
import resolveAnnotationPhaseIndexes from "../utils/resolveAnnotationPhaseIndexes";
import getPhaseIndexesAfterClick from "../utils/getPhaseIndexesAfterClick";
import setAnnotationsPhasesService from "../services/setAnnotationsPhasesService";
// registers the "assign the new annotations to the selected phases" hook
import "../services/requestPhaseAssignOnCreate";

const STRIP_HEIGHT = 40;
const STEP_HEIGHT = 24;
const STEP_MIN_WIDTH = 48;
// depth of the arrow tip / notch of a block, and thickness of its outline
const ARROW = 8;
const OUTLINE = 1;
// horizontal inset of the inside layer: the slanted edges need a bit more
// than the flat ones to read with the same thickness
const SIDE_INSET = OUTLINE * 1.2;
const PHASING_MODULE_KEY = getBusinessObjectsModuleKey(PHASING_TYPE_KEY);

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
        ml: isFirst ? 0 : `${-(ARROW + SIDE_INSET)}px`,
        pl: isFirst ? 0.5 : `${ARROW}px`,
        pr: `${ARROW}px`,
        border: 0,
        bgcolor: color,
        clipPath,
        opacity: dashed ? 0.6 : 1,
        font: "inherit",
        fontSize: 12,
        fontWeight: 600,
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
          left: `${SIDE_INSET}px`,
          right: `${SIDE_INSET}px`,
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
//   displayed; click = that phase only, again = everything, Shift
//   click = several; with ONE phase displayed, the "Phase x et après" button
//   selects it and every following one). New annotations are assigned to
//   exactly the selected ones.
// - Annotation(s) selected: the blocks in the secondary color are the
//   phases ALL of them are present in, a light tint = some of them only.
//   Same gestures as above, written for the whole selection in one batch
//   (one undo step): click = that phase only (again = every phase), Shift
//   click = that phase added / removed. Hovering a step fades the blocks its
//   click would change (the colors stay).
// - No PHASING listing in the scope while the Phasage module is enabled: the
//   strip shows in the Dessin and Phasage modules with a "create a phasing"
//   button (creates the listing).
// The strip is a dark band (phasingDarkTheme); its dialogs keep the app's
// light theme.
export default function StripPhases() {
  return (
    <ThemeProvider theme={phasingDarkTheme}>
      <StripPhasesContent />
    </ThemeProvider>
  );
}

function StripPhasesContent() {
  const dispatch = useDispatch();

  // strings

  const emptyS = "Aucune phase";
  const addS = "Ajouter une phase";
  const displayedS = "Phase affichée";
  const errorS = "Les phases n'ont pas pu être modifiées.";
  const andAfterS = "et après";
  const highlightS = "Nouveautés";
  const highlightTooltipS =
    "Mettre en évidence les nouvelles annotations des phases affichées (les autres sont éclaircies)";
  const previousS = "Phase précédente";
  const nextS = "Phase suivante";
  const noPhasingS = "Aucun phasage";
  const createPhasingS = "Créer un phasage";

  // data

  const theme = useTheme();
  const show = useShowCommandsToolbar();
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const moduleListingId = useSelector(
    (s) => s.businessObjects.selectedListingId
  );
  const selectedPhaseIds = useSelector((s) => s.phasing.selectedPhaseIds);
  const highlightNewAnnotations = useSelector(
    (s) => s.phasing.highlightNewAnnotations
  );
  const selectedItems = useSelector(selectSelectedItems);
  const phasingModuleEnabled = useSelector(
    (s) => !selectDisabledModuleKeys(s).includes(PHASING_MODULE_KEY)
  );
  const moduleLabel = useBusinessObjectsModuleLabel(PHASING_TYPE_KEY);

  const { listing, listings } = usePhasingListing();
  const listingId = show ? (listing?.id ?? null) : null;
  const phases = usePhases(listingId);
  const { value: rels } = useRelsPhaseAnnotation({ listingId });

  // state

  const [hoveredIndex, setHoveredIndex] = useState(null);
  // Shift held over the hovered step (the preview follows the gesture)
  const [hoveredAdditive, setHoveredAdditive] = useState(false);
  const [openCreate, setOpenCreate] = useState(false);
  const [openCreateListing, setOpenCreateListing] = useState(false);

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

  // What a click on `index` writes: annotationId -> Set of indexes. Same
  // gestures as the displayed phases, the whole selection going the same
  // way: plain click = that phase only (every phase when they are all in
  // that phase only), Shift click = that phase added (removed when they are
  // all in it).
  function getTargetAfterClick(index, additive) {
    const all = [...indexesByAnnotationId.values()];
    const remove = additive
      ? countByIndex[index] === annotationIds.length
      : all.every((indexes) => indexes.size === 1 && indexes.has(index));
    const target = new Map();
    indexesByAnnotationId.forEach((indexes, id) => {
      target.set(
        id,
        getPhaseIndexesAfterClick(indexes, index, {
          additive,
          remove,
          phasesCount: phases.length,
        })
      );
    });
    return target;
  }

  // hover preview (annotations selected): steps the selection would be in
  const previewCountByIndex = useMemo(() => {
    if (!hasAnnotations || hoveredIndex == null) return null;
    const counts = phases.map(() => 0);
    getTargetAfterClick(hoveredIndex, hoveredAdditive).forEach((indexes) => {
      indexes.forEach((index) => {
        if (index < counts.length) counts[index] += 1;
      });
    });
    return counts;
  }, [hasAnnotations, hoveredIndex, hoveredAdditive, indexesByAnnotationId]);

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
      const additive = Boolean(e.shiftKey);
      dispatch(togglePhaseSelection({ id: phase.id, additive }));
      return;
    }
    try {
      await setAnnotationsPhasesService({
        listing,
        phases,
        indexesByAnnotationId: getTargetAfterClick(index, Boolean(e.shiftKey)),
      });
      dispatch(triggerRelsPhaseAnnotationUpdate());
    } catch (error) {
      console.error("[StripPhases]", error);
      dispatch(
        setToaster({ message: error?.message || errorS, isError: true })
      );
    }
  }

  function handleSelectAndAfter() {
    const index = phases.findIndex((phase) => phase.id === selectedPhaseIds[0]);
    if (index < 0) return;
    dispatch(setSelectedPhaseIds(phases.slice(index).map((p) => p.id)));
  }

  // previous / next arrows: ONE displayed phase, the one before the first
  // displayed / after the last displayed (none displayed: the last / first)
  function getSteppedPhase(delta) {
    const indexes = phases
      .map((phase, index) => (selectedPhaseIds.includes(phase.id) ? index : -1))
      .filter((index) => index >= 0);
    if (indexes.length === 0)
      return (delta > 0 ? phases[0] : phases[phases.length - 1]) ?? null;
    const index =
      delta > 0 ? Math.max(...indexes) + 1 : Math.min(...indexes) - 1;
    return phases[index] ?? null;
  }

  function handleStep(delta) {
    const phase = getSteppedPhase(delta);
    if (phase) dispatch(setSelectedPhaseIds([phase.id]));
  }

  // render

  if (!show) return null;

  // no PHASING listing yet (`listings` is undefined while loading)
  if (!listing) {
    const showEmptyStrip =
      phasingModuleEnabled &&
      listings?.length === 0 &&
      (viewerKey === "MAP" || isPhasingModule);
    if (!showEmptyStrip) return null;
    return (
      <Box
        sx={{
          flexShrink: 0,
          height: STRIP_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 2,
          px: 2,
          bgcolor: "background.paper",
          color: "text.primary",
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
          {`${moduleLabel} — ${noPhasingS.toLowerCase()}`}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={() => setOpenCreateListing(true)}
          sx={{
            flexShrink: 0,
            height: STEP_HEIGHT,
            textTransform: "none",
            whiteSpace: "nowrap",
          }}
        >
          {createPhasingS}
        </Button>
        <ThemeProvider theme={appTheme}>
          <DialogCreateBusinessObjectListing
            open={openCreateListing}
            typeKey={PHASING_TYPE_KEY}
            onClose={() => setOpenCreateListing(false)}
            onCreated={(created) =>
              dispatch(setActivePhasingListingId(created.id))
            }
          />
        </ThemeProvider>
      </Box>
    );
  }

  const total = annotationIds.length;
  const selectedPhaseNumbers = phases
    .map((phase, index) =>
      selectedPhaseIds.includes(phase.id) ? index + 1 : null
    )
    .filter(Boolean);
  const singlePhaseNumber =
    selectedPhaseNumbers.length === 1 ? selectedPhaseNumbers[0] : null;
  // the names of the selected phases show next to the arrows, in the order
  // of the phases, each renamed in place
  const selectedPhases = selectedPhaseNumbers.map(
    (number) => phases[number - 1]
  );
  // ONE displayed phase that is not the last: button extending the selection
  // to that phase and every following one
  const showAndAfter =
    !hasAnnotations &&
    singlePhaseNumber != null &&
    singlePhaseNumber < phases.length;
  // light tint of the period color: phases only SOME of the selected
  // annotations are in
  const partialColor = lighten(theme.palette.secondary.main, 0.6);
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
        justifyContent: "flex-start",
        gap: 2,
        px: 2,
        // the nested theme does not change the color inherited from <body>
        color: "text.primary",
        bgcolor: "background.paper",
        borderBottom: 1,
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <SelectorPhasingListing listing={listing} listings={listings} />

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
          //   secondary color (a light tint of it when only some of the
          //   annotations are in the phase). The colors always show the
          //   CURRENT period: hovering a step only fades the blocks its
          //   click would change.
          const count = hasAnnotations ? countByIndex[index] : 0;
          const isActive =
            !hasAnnotations && selectedPhaseIds.includes(phase.id);
          const isFull = hasAnnotations && count === total;
          const isPartial = hasAnnotations && count > 0 && count < total;
          // block the hovered click would change
          const isChanging =
            previewCountByIndex != null &&
            previewCountByIndex[index] !== countByIndex[index];
          // A filled block is outlined in the color of the band: two
          // filled neighbours read as two blocks split by a thin line.
          const color = isActive || isFull || isPartial ? paper : idleColor;
          const fill = isActive
            ? activeColor
            : isFull
              ? periodColor
              : isPartial
                ? partialColor
                : paper;
          const textColor =
            isActive || isFull || isPartial
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
                onMouseMove={(e) => setHoveredAdditive(Boolean(e.shiftKey))}
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

      {selectedPhases.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            minWidth: 0,
            flexShrink: 1,
            overflow: "hidden",
          }}
        >
          {selectedPhases.map((phase, index) => (
            <Fragment key={phase.id}>
              {index > 0 && (
                <Box
                  component="span"
                  sx={{ color: "text.secondary", fontSize: 12, flexShrink: 0 }}
                >
                  ·
                </Box>
              )}
              <FieldPhaseNameInline phase={phase} />
            </Fragment>
          ))}
        </Box>
      )}

      {showAndAfter && (
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={handleSelectAndAfter}
          sx={{
            flexShrink: 0,
            height: STEP_HEIGHT,
            py: 0,
            fontSize: 12,
            textTransform: "none",
            whiteSpace: "nowrap",
            borderColor: "divider",
          }}
        >
          {`Phase ${singlePhaseNumber} ${andAfterS}`}
        </Button>
      )}

      {/* right side of the strip */}
      <Box
        sx={{
          ml: "auto",
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexShrink: 0,
        }}
      >
        <Tooltip title={highlightTooltipS}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={highlightNewAnnotations}
                onChange={(e) =>
                  dispatch(setHighlightNewAnnotations(e.target.checked))
                }
                // dark band: grey when off, light when on (no accent color)
                sx={{
                  "& .MuiSwitch-switchBase": { color: "text.secondary" },
                  "& .MuiSwitch-switchBase + .MuiSwitch-track": {
                    bgcolor: "text.secondary",
                    opacity: 0.35,
                  },
                  "& .MuiSwitch-switchBase.Mui-checked": {
                    color: "text.primary",
                  },
                  "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                    bgcolor: "text.primary",
                    opacity: 0.5,
                  },
                }}
              />
            }
            label={
              <Typography
                variant="caption"
                noWrap
                sx={{
                  color: highlightNewAnnotations
                    ? "text.primary"
                    : "text.secondary",
                }}
              >
                {highlightS}
              </Typography>
            }
            sx={{ m: 0, gap: 0.5 }}
          />
        </Tooltip>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title={previousS}>
            <span>
              <IconButton
                size="small"
                color="inherit"
                disabled={!getSteppedPhase(-1)}
                onClick={() => handleStep(-1)}
                sx={{ p: 0.5 }}
              >
                <ChevronLeft sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={nextS}>
            <span>
              <IconButton
                size="small"
                color="inherit"
                disabled={!getSteppedPhase(1)}
                onClick={() => handleStep(1)}
                sx={{ p: 0.5 }}
              >
                <ChevronRight sx={{ fontSize: 20 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <ThemeProvider theme={appTheme}>
        <DialogCreatePhase
          open={openCreate}
          onClose={() => setOpenCreate(false)}
          listing={listing}
          phases={phases}
        />
      </ThemeProvider>
    </Box>
  );
}
