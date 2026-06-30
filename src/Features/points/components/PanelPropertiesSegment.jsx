import { useDispatch } from "react-redux";

import { setSubSelection } from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  IconButton,
  TextField,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import useSelectedSegmentData from "Features/points/hooks/useSelectedSegmentData";
import useToggleSegmentIsoHeight from "Features/points/hooks/useToggleSegmentIsoHeight";
import useSegmentsExtEdge from "Features/points/hooks/useSegmentsExtEdge";
import useSegmentsIntEdge from "Features/points/hooks/useSegmentsIntEdge";

function ReadOnlyOffset({ label, value }) {
  return (
    <TextField
      label={label}
      size="small"
      value={value ?? 0}
      InputProps={{ readOnly: true }}
      variant="filled"
    />
  );
}

export default function PanelPropertiesSegment() {
  const dispatch = useDispatch();

  // data

  const { segIdx, pointA, pointB, isIso } = useSelectedSegmentData();
  const toggleIsoHeight = useToggleSegmentIsoHeight();
  const { checked: isExtEdge, toggle: toggleExtEdge } = useSegmentsExtEdge();
  const { checked: isIntEdge, toggle: toggleIntEdge } = useSegmentsIntEdge();

  // handlers

  function handleBack() {
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  function handleIsoChange() {
    toggleIsoHeight();
  }

  function handleExtEdgeChange() {
    toggleExtEdge();
  }

  function handleIntEdgeChange() {
    toggleIntEdge();
  }

  // render - no selection

  if (segIdx == null || !pointA || !pointB) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune arête sélectionnée
        </Typography>
      </Box>
    );
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
            {`Arête N°${segIdx + 1}`}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!isIso}
                onChange={handleIsoChange}
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
                onChange={handleExtEdgeChange}
                size="small"
              />
            }
            label={<Typography variant="body2">Segment extérieur</Typography>}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={!!isIntEdge}
                onChange={handleIntEdgeChange}
                size="small"
              />
            }
            label={<Typography variant="body2">Segment intérieur</Typography>}
          />
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            Point 1 — décalages (m)
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <ReadOnlyOffset label="Décalage bas" value={pointA.offsetBottom} />
            <ReadOnlyOffset label="Décalage haut" value={pointA.offsetTop} />
          </Box>
        </Box>

        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
            Point 2 — décalages (m)
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <ReadOnlyOffset label="Décalage bas" value={pointB.offsetBottom} />
            <ReadOnlyOffset label="Décalage haut" value={pointB.offsetTop} />
          </Box>
        </Box>
      </Box>
    </BoxFlexVStretch>
  );
}
