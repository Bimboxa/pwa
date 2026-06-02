import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { setSubSelection } from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  IconButton,
  TextField,
  Menu,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack as Back,
  MoreVert as MoreActionsIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import useSelectedGuideLineData from "Features/annotations/hooks/useSelectedGuideLineData";
import useApplyGuideLineSlope from "Features/annotations/hooks/useApplyGuideLineSlope";
import useDeleteGuideLine from "Features/annotations/hooks/useDeleteGuideLine";

export default function PanelPropertiesGuideline() {
  const dispatch = useDispatch();

  // data

  const { annotation, slopePct, hasGuideLine } = useSelectedGuideLineData();
  const applySlope = useApplyGuideLineSlope();
  const deleteGuideLine = useDeleteGuideLine();

  // state

  const [value, setValue] = useState(String(slopePct ?? 0));
  const [anchorEl, setAnchorEl] = useState(null);

  // keep the field in sync when the underlying slope changes (e.g. undo)
  useEffect(() => {
    setValue(String(Number.isFinite(slopePct) ? slopePct : 0));
  }, [slopePct]);

  // handlers

  function handleBack() {
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  function commit() {
    const next = parseFloat(value);
    if (!Number.isFinite(next)) return;
    if (next === Number(slopePct)) return;
    applySlope(next);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  function handleDelete() {
    setAnchorEl(null);
    if (annotation?.id) deleteGuideLine({ annotationId: annotation.id });
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  // render - no selection

  if (!annotation || !hasGuideLine) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucune ligne guide sélectionnée
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
            Ligne guide
          </Typography>
        </Box>
        <IconButton
          sx={{ ml: "auto" }}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          <MoreActionsIcon />
        </IconButton>
        <Menu
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
        >
          <MenuItem onClick={handleDelete}>Supprimer</MenuItem>
        </Menu>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Pente"
          type="number"
          size="small"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          InputProps={{
            endAdornment: <InputAdornment position="end">%</InputAdornment>,
          }}
        />
        <Typography variant="caption" color="text.secondary">
          La hauteur de chaque sommet est interpolée le long de la ligne guide
          (lignes iso perpendiculaires). La surface et le périmètre sont
          recalculés en conséquence.
        </Typography>
      </Box>
    </BoxFlexVStretch>
  );
}
