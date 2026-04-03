import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";
import { setShowLayers, setSoloMode } from "../popperMapListingsSlice";
import { setVisibleAreaOnly } from "Features/smartDetect/smartDetectSlice";

import {
  Box,
  Typography,
  IconButton,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";
import FieldSortableListings from "./FieldSortableListings";

export default function PanelPropertiesPopperMapListings() {
  const dispatch = useDispatch();
  const updateScope = useUpdateScope();

  // data

  const { value: scope } = useSelectedScope();
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);
  const soloMode = useSelector((s) => s.popperMapListings.soloMode);
  const visibleAreaOnly = useSelector((s) => s.smartDetect.visibleAreaOnly);

  // helpers

  const scopeName = scope?.name ?? "-?-";

  // handlers

  const handleNameChange = (name) => {
    if (name && name.trim() && scope) {
      updateScope({ id: scope.id, name: name.trim() });
    }
  };

  // render

  if (!scope) return null;

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={() => dispatch(clearSelection())}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Repérages
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {scopeName}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflowY: "auto", p: 1.5, gap: 1 }}>
        {/* Card 1: Scope name */}
        <FieldTextV2
          label="Krto"
          value={scope.name}
          onChange={handleNameChange}
          options={{ showAsSection: true, fullWidth: true, changeOnBlur: true }}
        />

        {/* Card 2: Sortable listings */}
        <FieldSortableListings />

        {/* Card 3: Layers toggle */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              color: "text.secondary",
              letterSpacing: 0.5,
              mb: 0.5,
              display: "block",
            }}
          >
            Calques
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showLayers}
                onChange={(e) => dispatch(setShowLayers(e.target.checked))}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Travailler avec des calques
              </Typography>
            }
            sx={{ ml: 0 }}
          />
        </WhiteSectionGeneric>

        {/* Card 3: Visibility */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              color: "text.secondary",
              letterSpacing: 0.5,
              mb: 0.5,
              display: "block",
            }}
          >
            Visibilité
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={soloMode}
                onChange={(e) => dispatch(setSoloMode(e.target.checked))}
                size="small"
              />
            }
            label={<Typography variant="body2">Mode solo</Typography>}
            sx={{ ml: 0 }}
          />
        </WhiteSectionGeneric>

        {/* Card 4: Auto-detection options */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              color: "text.secondary",
              letterSpacing: 0.5,
              mb: 0.5,
              display: "block",
            }}
          >
            Détection auto
          </Typography>
          <FieldCheck
            value={visibleAreaOnly}
            onChange={(v) => dispatch(setVisibleAreaOnly(v))}
            label="Détection sur partie visible de l'image"
            options={{ type: "check", showAsInline: true }}
          />
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
