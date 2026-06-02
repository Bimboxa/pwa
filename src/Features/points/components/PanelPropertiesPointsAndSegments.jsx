import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedPartIds,
  setSelectedPartIds,
  clearSelectedPointIds,
  clearSelectedPartIds,
} from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import {
  ArrowBack as Back,
  SquareOutlined as SquareIcon,
  CircleOutlined as CircleIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import useSelectedPointsData from "Features/points/hooks/useSelectedPointsData";
import useUpdateSelectedPoints from "Features/points/hooks/useUpdateSelectedPoints";
import useSegmentsExtEdge from "Features/points/hooks/useSegmentsExtEdge";
import useToggleSegmentsIsoHeight from "Features/points/hooks/useToggleSegmentsIsoHeight";

// Combined panel shown when a lasso (or successive shift+clicks) selects BOTH
// vertices and segments of a single annotation. It exposes the point controls
// (shape, offsets, isSliding) and the segment controls (isoHeight, extEdge) at
// once, and lets the user narrow the selection to one kind. Re-lassoing keeps
// refining the selection (handled upstream in InteractionLayer).
export default function PanelPropertiesPointsAndSegments() {
  const dispatch = useDispatch();

  // data

  const { selectedPoints, mixed } = useSelectedPointsData();
  const updateSelectedPoints = useUpdateSelectedPoints();
  const selectedPartIds = useSelector(selectSelectedPartIds);
  const {
    checked: isExtEdge,
    indeterminate: extEdgeMixed,
    toggle: toggleExtEdge,
  } = useSegmentsExtEdge();
  const {
    checked: isIso,
    indeterminate: isoMixed,
    toggle: toggleIso,
  } = useToggleSegmentsIsoHeight();

  // helpers

  const pointsCount = selectedPoints.length;
  const segmentsCount = selectedPartIds.length;

  const typeValue = mixed.type ? null : (selectedPoints[0]?.type ?? "square");
  const offsetBottomValue = mixed.offsetBottom
    ? ""
    : (selectedPoints[0]?.offsetBottom ?? 0);
  const offsetTopValue = mixed.offsetTop
    ? ""
    : (selectedPoints[0]?.offsetTop ?? 0);
  const isSlidingValue = mixed.isSliding
    ? false
    : !!selectedPoints[0]?.isSliding;

  // local state for the numeric inputs

  const [bottomDraft, setBottomDraft] = useState(String(offsetBottomValue));
  const [topDraft, setTopDraft] = useState(String(offsetTopValue));

  useEffect(() => {
    setBottomDraft(String(offsetBottomValue));
  }, [offsetBottomValue, pointsCount]);

  useEffect(() => {
    setTopDraft(String(offsetTopValue));
  }, [offsetTopValue, pointsCount]);

  // handlers

  function handleBack() {
    dispatch(clearSelectedPointIds());
    dispatch(clearSelectedPartIds());
  }

  function handleKeepPointsOnly() {
    dispatch(setSelectedPartIds([]));
  }

  function handleKeepSegmentsOnly() {
    dispatch(clearSelectedPointIds());
  }

  function handleTypeChange(_e, newType) {
    if (!newType) return;
    updateSelectedPoints({ type: newType });
  }

  function commitOffsetBottom() {
    const n = parseFloat(bottomDraft);
    updateSelectedPoints({ offsetBottom: Number.isFinite(n) ? n : 0 });
  }

  function commitOffsetTop() {
    const n = parseFloat(topDraft);
    updateSelectedPoints({ offsetTop: Number.isFinite(n) ? n : 0 });
  }

  function handleIsSlidingChange(e) {
    updateSelectedPoints({ isSliding: e.target.checked });
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", alignItems: "center", p: 0.5, pl: 1 }}>
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Sélection
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {`${pointsCount} point${pointsCount > 1 ? "s" : ""} · ${segmentsCount} segment${segmentsCount > 1 ? "s" : ""}`}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 1, display: "flex", gap: 1 }}>
        <Button size="small" variant="outlined" onClick={handleKeepPointsOnly}>
          Garder les points
        </Button>
        <Button size="small" variant="outlined" onClick={handleKeepSegmentsOnly}>
          Garder les segments
        </Button>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
        {/* Points section */}
        {pointsCount > 0 && (
          <>
            <Typography variant="overline" color="text.secondary">
              {`Points (${pointsCount})`}
            </Typography>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Forme
              </Typography>
              <ToggleButtonGroup
                value={typeValue}
                exclusive
                onChange={handleTypeChange}
                size="small"
                fullWidth
              >
                <ToggleButton value="square">
                  <SquareIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">Carré</Typography>
                </ToggleButton>
                <ToggleButton value="circle">
                  <CircleIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">Cercle</Typography>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
                Décalages (m)
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <TextField
                  label="Décalage bas"
                  type="number"
                  size="small"
                  value={bottomDraft}
                  placeholder={mixed.offsetBottom ? "Mixte" : "0"}
                  inputProps={{ step: 0.1 }}
                  onChange={(e) => setBottomDraft(e.target.value)}
                  onBlur={commitOffsetBottom}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <TextField
                  label="Décalage haut"
                  type="number"
                  size="small"
                  value={topDraft}
                  placeholder={mixed.offsetTop ? "Mixte" : "0"}
                  inputProps={{ step: 0.1 }}
                  onChange={(e) => setTopDraft(e.target.value)}
                  onBlur={commitOffsetTop}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
              </Box>
            </Box>

            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isSlidingValue}
                    indeterminate={!!mixed.isSliding}
                    onChange={handleIsSlidingChange}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    Point coulissant (isSliding)
                  </Typography>
                }
              />
            </Box>
          </>
        )}

        {pointsCount > 0 && segmentsCount > 0 && <Divider />}

        {/* Segments section */}
        {segmentsCount > 0 && (
          <>
            <Typography variant="overline" color="text.secondary">
              {`Segments (${segmentsCount})`}
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!isIso}
                    indeterminate={!!isoMixed}
                    onChange={toggleIso}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">
                    Courbe de niveau (isoHeight)
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!isExtEdge}
                    indeterminate={!!extEdgeMixed}
                    onChange={toggleExtEdge}
                    size="small"
                  />
                }
                label={<Typography variant="body2">Segment extérieur</Typography>}
              />
            </Box>
          </>
        )}
      </Box>
    </BoxFlexVStretch>
  );
}
