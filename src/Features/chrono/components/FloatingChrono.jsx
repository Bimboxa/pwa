import { useCallback, useEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CloseIcon from "@mui/icons-material/Close";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";

import {
  setChronoPosition,
  setChronoVisible,
  toggleChronoMinimized,
  openChronoCreate,
  stopChronoStep,
  resetChrono,
} from "../chronoSlice";

import useChronoTick from "../hooks/useChronoTick";
import usePanelDrag from "../hooks/usePanelDrag";

import getDefaultChronoPosition from "../utils/getDefaultChronoPosition";

import ChronoTimeDisplay from "./ChronoTimeDisplay";
import ChronoStepsList from "./ChronoStepsList";

const PANEL_WIDTH = 280;

export default function FloatingChrono() {
  const dispatch = useDispatch();

  // data

  const visible = useSelector((s) => s.chrono.visible);
  const position = useSelector((s) => s.chrono.position);
  const minimized = useSelector((s) => s.chrono.minimized);
  const activeStep = useSelector((s) => s.chrono.activeStep);
  const steps = useSelector((s) => s.chrono.steps);

  const now = useChronoTick(Boolean(activeStep));

  // effects

  // First time the panel becomes visible without a stored position,
  // default it to the bottom-right corner.
  useEffect(() => {
    if (visible && !position) {
      dispatch(setChronoPosition(getDefaultChronoPosition(PANEL_WIDTH)));
    }
  }, [visible, position, dispatch]);

  // drag

  const handleDragChange = useCallback(
    (next) => dispatch(setChronoPosition(next)),
    [dispatch]
  );
  const { handleMouseDown } = usePanelDrag({
    position: position ?? { x: 0, y: 0 },
    onChange: handleDragChange,
  });

  // refs

  const panelRef = useRef(null);

  // helpers

  const elapsedMs = activeStep ? now - activeStep.startedAt : 0;
  const completedMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const totalMs = completedMs + elapsedMs;
  const hasContent = Boolean(activeStep) || steps.length > 0;

  // handlers

  function handleClose() {
    dispatch(setChronoVisible(false));
  }

  function handleToggleMinimize() {
    const el = panelRef.current;
    if (!el) {
      dispatch(toggleChronoMinimized());
      return;
    }
    // Snapshot the corner closest to a viewport edge so it stays put
    // after the size changes.
    const prev = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const anchorRight = vw - prev.right < prev.left;
    const anchorBottom = vh - prev.bottom < prev.top;

    dispatch(toggleChronoMinimized());

    // After the new size has been laid out, shift `position` so the
    // anchored corner is preserved.
    requestAnimationFrame(() => {
      if (!panelRef.current) return;
      const next = panelRef.current.getBoundingClientRect();
      let x = prev.left;
      let y = prev.top;
      if (anchorRight) x = prev.right - next.width;
      if (anchorBottom) y = prev.bottom - next.height;
      const vw2 = window.innerWidth;
      const vh2 = window.innerHeight;
      x = Math.max(0, Math.min(vw2 - next.width, x));
      y = Math.max(0, Math.min(vh2 - next.height, y));
      if (x !== prev.left || y !== prev.top) {
        dispatch(setChronoPosition({ x, y }));
      }
    });
  }

  function handleAddStep() {
    dispatch(openChronoCreate());
  }

  function handleStop() {
    dispatch(stopChronoStep());
  }

  function handleReset() {
    dispatch(resetChrono());
  }

  // render

  if (!visible || !position) return null;

  return (
    <Box
      ref={panelRef}
      sx={{
        position: "fixed",
        top: position.y,
        left: position.x,
        width: minimized ? "auto" : PANEL_WIDTH,
        zIndex: 1400,
        bgcolor: "white",
        borderRadius: 2,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        overflow: "hidden",
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderTop: (theme) => `3px solid ${theme.palette.secondary.main}`,
      }}
    >
      {/* header / drag handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 0.75,
          py: 0.5,
          bgcolor: "grey.50",
          cursor: "move",
          userSelect: "none",
          touchAction: "none",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
          <DragIndicatorIcon sx={{ color: "text.disabled" }} />
          {minimized ? (
            <ChronoTimeDisplay
              ms={activeStep ? elapsedMs : totalMs}
              size="header"
            />
          ) : (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "secondary.main",
              }}
            >
              Chrono
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          {minimized && (
            <Tooltip title={activeStep ? "Nouvelle étape" : "Démarrer"}>
              <IconButton
                size="small"
                onClick={handleAddStep}
                sx={{
                  color: "secondary.main",
                  mr: 0.25,
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={minimized ? "Agrandir" : "Réduire"}>
            <IconButton size="small" onClick={handleToggleMinimize}>
              {minimized ? (
                <UnfoldMoreIcon fontSize="small" />
              ) : (
                <UnfoldLessIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title="Masquer">
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* body — hidden when minimized */}
      {!minimized && (
        <Box sx={{ p: 1.5 }}>
          <ChronoTimeDisplay ms={elapsedMs} />

          <Typography
            variant="body2"
            sx={{
              mt: 0.75,
              textAlign: "center",
              color: activeStep ? "text.primary" : "text.disabled",
              fontStyle: activeStep ? "normal" : "italic",
              minHeight: "1.25em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={activeStep?.name}
          >
            {activeStep ? activeStep.name : "Aucune étape en cours"}
          </Typography>

          {/* actions */}
          <Box
            sx={{
              mt: 1.25,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
            }}
          >
            <Tooltip title={activeStep ? "Nouvelle étape" : "Démarrer"}>
              <IconButton
                onClick={handleAddStep}
                sx={{
                  bgcolor: "secondary.main",
                  color: "white",
                  "&:hover": { bgcolor: "secondary.dark" },
                  width: 40,
                  height: 40,
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Arrêter">
              <span>
                <IconButton
                  onClick={handleStop}
                  disabled={!activeStep}
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    width: 36,
                    height: 36,
                  }}
                >
                  <StopIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Réinitialiser">
              <span>
                <IconButton
                  onClick={handleReset}
                  disabled={!hasContent}
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    width: 36,
                    height: 36,
                  }}
                >
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <ChronoStepsList steps={steps} />

          {/* total */}
          {hasContent && (
            <Box
              sx={{
                mt: 1,
                pt: 0.75,
                borderTop: (theme) => `1px dashed ${theme.palette.divider}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "text.secondary",
                  fontSize: "0.65rem",
                }}
              >
                Total
              </Typography>
              <ChronoTimeDisplay ms={totalMs} size="small" />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
