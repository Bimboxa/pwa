import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { clearSelectedPointIds } from "Features/selection/selectionSlice";

import {
  Box,
  Typography,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
} from "@mui/material";
import {
  ArrowBack as Back,
  SquareOutlined as SquareIcon,
  CircleOutlined as CircleIcon,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import useSelectedPointsData from "Features/points/hooks/useSelectedPointsData";
import useUpdateSelectedPoints from "Features/points/hooks/useUpdateSelectedPoints";

export default function PanelPropertiesPoints() {
  const dispatch = useDispatch();

  // data

  const { selectedPoints, mixed } = useSelectedPointsData();
  const updateSelectedPoints = useUpdateSelectedPoints();

  // helpers

  const count = selectedPoints.length;
  const headerLabel = count > 1 ? `Points · ${count}` : "Point";

  const typeValue = mixed.type ? null : selectedPoints[0]?.type ?? "square";
  const offsetBottomValue = mixed.offsetBottom
    ? ""
    : (selectedPoints[0]?.offsetBottom ?? 0);
  const offsetTopValue = mixed.offsetTop
    ? ""
    : (selectedPoints[0]?.offsetTop ?? 0);

  // local state for the numeric inputs (so typing doesn't fight the live db value)

  const [bottomDraft, setBottomDraft] = useState(String(offsetBottomValue));
  const [topDraft, setTopDraft] = useState(String(offsetTopValue));

  useEffect(() => {
    setBottomDraft(String(offsetBottomValue));
  }, [offsetBottomValue, count]);

  useEffect(() => {
    setTopDraft(String(offsetTopValue));
  }, [offsetTopValue, count]);

  // handlers

  function handleBack() {
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

  // render - no selection

  if (!count) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aucun point sélectionné
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
            {headerLabel}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
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
      </Box>
    </BoxFlexVStretch>
  );
}
