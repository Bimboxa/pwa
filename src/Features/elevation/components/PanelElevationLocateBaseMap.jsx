import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setShowCalibration,
  setCalibrationTargets,
  setCalibrationTargetVisible,
} from "Features/baseMapEditor/baseMapEditorSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  alpha,
  Box,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

import db from "App/db/db";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import ElevationBaseMapSelector from "./ElevationBaseMapSelector";
import ElevationBaseMapViewer from "./ElevationBaseMapViewer";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import computeVerticalBaseMapPlacement from "Features/baseMaps/js/computeVerticalBaseMapPlacement";
import {
  DEFAULT_RED,
  DEFAULT_GREEN,
} from "Features/mapEditor/utils/computeCalibrationTransform";

const RED = "#e53935";
const GREEN = "#43a047";

// Calibration targets are stored per baseMap VERSION (see
// baseMapEditor.calibrationTargetsByVersionId); legacy baseMaps without
// versions fall back to their own id.
function getTargetsKey(baseMap) {
  if (!baseMap) return null;
  return baseMap.getActiveVersion?.()?.id ?? baseMap.id;
}

// "Élévation" panel of the BASE_MAPS module: browse the project's VERTICAL
// baseMaps (elevations / sections) and locate one of them in the main 3D
// referential from two calibration targets pointed both on the plan view (the
// 2D editor behind this panel) and on the elevation below.
//
//   - reference target -> horizontal placement + height (absolute Z)
//   - other target     -> rotation around the vertical axis
//
// The elevation's scale (meterByPx) is never changed.
export default function PanelElevationLocateBaseMap() {
  const dispatch = useDispatch();

  // state

  const [selectedBaseMapId, setSelectedBaseMapId] = useState(null);
  const [locating, setLocating] = useState(false);
  const [refColor, setRefColor] = useState("green");
  const [refHeightStr, setRefHeightStr] = useState(null);

  // data

  const { value: baseMaps = [] } = useBaseMaps({});
  const firstVerticalBaseMapId = (baseMaps ?? []).find(
    (bm) => bm?.orientation === "VERTICAL"
  )?.id;

  const elevationBaseMap = useBaseMap({ id: selectedBaseMapId });
  const planBaseMap = useMainBaseMap();

  const targetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );

  // helpers

  const elevationKey = getTargetsKey(elevationBaseMap);
  const planKey = getTargetsKey(planBaseMap);

  const elevationTargets = elevationKey
    ? (targetsByVersionId[elevationKey] ?? {
        red: DEFAULT_RED,
        green: DEFAULT_GREEN,
      })
    : null;
  const planTargets = planKey
    ? (targetsByVersionId[planKey] ?? {
        red: DEFAULT_RED,
        green: DEFAULT_GREEN,
      })
    : null;

  // The plan view must be another baseMap, laid flat.
  const planIsUsable =
    Boolean(planBaseMap) &&
    planBaseMap.id !== selectedBaseMapId &&
    planBaseMap.orientation !== "VERTICAL";

  // Current height of the reference target, used as the field's initial value.
  const currentRefHeight = useMemo(() => {
    if (!elevationBaseMap || !elevationTargets) return null;
    const imageSize = elevationBaseMap.getImageSize?.();
    const meterByPx = elevationBaseMap.getMeterByPx?.();
    if (!imageSize?.height || !meterByPx) return null;
    const rel = elevationTargets[refColor];
    const ly = -(rel.y * imageSize.height - imageSize.height / 2) * meterByPx;
    return getBaseMapTransform(elevationBaseMap).position.y + ly;
  }, [elevationBaseMap, elevationTargets, refColor]);

  const refHeight =
    refHeightStr != null
      ? parseFloat(String(refHeightStr).replace(",", "."))
      : currentRefHeight;

  const placement =
    locating && planIsUsable && Number.isFinite(refHeight)
      ? computeVerticalBaseMapPlacement({
          planBaseMap,
          planTargets,
          elevationBaseMap,
          elevationTargets,
          refColor,
          refHeight,
        })
      : null;

  // effect - default to the first vertical baseMap

  useEffect(() => {
    if (!selectedBaseMapId && firstVerticalBaseMapId) {
      setSelectedBaseMapId(firstVerticalBaseMapId);
    }
  }, [selectedBaseMapId, firstVerticalBaseMapId]);

  // effect - show the draggable calibration targets in the 2D editor while the
  // locating mode is on (same mechanism as the "Position 3D" panel).

  useEffect(() => {
    if (!locating) return;
    dispatch(setShowCalibration(true));
    dispatch(setCalibrationTargetVisible({ color: "red", visible: true }));
    dispatch(setCalibrationTargetVisible({ color: "green", visible: true }));
    return () => dispatch(setShowCalibration(false));
  }, [locating, dispatch]);

  // handlers

  function handleSelectBaseMap(id) {
    setSelectedBaseMapId(id);
    setRefHeightStr(null);
  }

  function handleElevationTargetsChange(nextTargets) {
    if (!elevationKey) return;
    dispatch(
      setCalibrationTargets({ versionId: elevationKey, ...nextTargets })
    );
  }

  async function handleLocate() {
    if (!placement || !selectedBaseMapId) return;
    await db.baseMaps.update(selectedBaseMapId, {
      angleDeg: placement.angleDeg,
      position: placement.position,
    });
    dispatch(triggerBaseMapsUpdate());
    dispatch(setToaster({ message: "Élévation positionnée" }));
  }

  // helpers - render

  const disabledReason = !locating
    ? null
    : !selectedBaseMapId
      ? "Sélectionnez une élévation."
      : !planIsUsable
        ? "Affichez la vue en plan dans l'éditeur 2D (sélectionnez un fond de plan horizontal dans l'arborescence)."
        : !Number.isFinite(refHeight)
          ? "Saisissez la hauteur du point de référence."
          : !placement
            ? "Cibles inexploitables : elles doivent être distinctes sur le plan et à des abscisses différentes sur l'élévation."
            : null;

  // render

  return (
    <BoxFlexVStretch sx={{ height: 1 }}>
      {/* Header — elevation selector + locate toggle */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          p: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <ElevationBaseMapSelector
          value={selectedBaseMapId}
          onChange={handleSelectBaseMap}
        />

        <Button
          variant="outlined"
          color="inherit"
          startIcon={<MyLocationIcon />}
          disabled={!selectedBaseMapId}
          onClick={() => setLocating((v) => !v)}
          sx={{
            textTransform: "none",
            borderRadius: 2,
            borderColor: "divider",
            bgcolor: locating ? "action.selected" : "background.paper",
          }}
        >
          Localiser le fond de plan
        </Button>
      </Box>

      <ElevationBaseMapViewer
        baseMapId={selectedBaseMapId}
        targets={locating ? elevationTargets : null}
        onTargetsChange={handleElevationTargetsChange}
      />

      {locating && (
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
          {/* How-to */}
          <Box
            sx={{
              display: "flex",
              gap: 1.5,
              m: 1.5,
              p: 1.5,
              borderRadius: 1,
              bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
            }}
          >
            <InfoOutlinedIcon fontSize="small" sx={{ color: "info.main" }} />
            <Box>
              <Typography variant="body2" color="text.secondary">
                {"Placez la cible "}
                <Box component="span" sx={{ color: GREEN, fontWeight: 700 }}>
                  verte
                </Box>
                {" et la cible "}
                <Box component="span" sx={{ color: RED, fontWeight: 700 }}>
                  rouge
                </Box>
                {
                  " sur deux points reconnaissables, d'abord dans la vue en plan (éditeur 2D), puis aux mêmes endroits sur l'élévation ci-dessus."
                }
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {
                  "Le point de référence fixe la position (plan + hauteur) ; la seconde cible donne l'angle de rotation."
                }
              </Typography>
            </Box>
          </Box>

          {/* Reference point — target + absolute height */}
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 2,
              px: 1.5,
              pb: 1,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary" noWrap>
                Point de référence
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={refColor}
                onChange={(e, v) => v && setRefColor(v)}
                sx={{ display: "flex", mt: 0.5 }}
              >
                {[
                  { value: "green", label: "Vert", color: GREEN },
                  { value: "red", label: "Rouge", color: RED },
                ].map((option) => (
                  <ToggleButton
                    key={option.value}
                    value={option.value}
                    sx={{
                      gap: 0.75,
                      px: 1.5,
                      py: 0.5,
                      textTransform: "none",
                      "&.Mui-selected": {
                        bgcolor: alpha(option.color, 0.12),
                        borderColor: option.color,
                        "&:hover": { bgcolor: alpha(option.color, 0.2) },
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        bgcolor: option.color,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: refColor === option.value ? 700 : 400,
                      }}
                    >
                      {option.label}
                    </Typography>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" noWrap>
                Hauteur
              </Typography>
              <Box
                sx={{
                  mt: 0.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "background.paper",
                }}
              >
                <FieldAnnotationHeight
                  annotation={{
                    id: `${selectedBaseMapId}-${refColor}`,
                    refHeight:
                      refHeightStr ??
                      (Number.isFinite(currentRefHeight)
                        ? Math.round(currentRefHeight * 1000) / 1000
                        : ""),
                  }}
                  field="refHeight"
                  label="ht."
                  onChange={(next) => setRefHeightStr(next.refHeight ?? "")}
                />
              </Box>
            </Box>
          </Box>

          {disabledReason && (
            <Typography
              variant="caption"
              color="warning.main"
              sx={{ display: "block", px: 1.5, pb: 1 }}
            >
              {disabledReason}
            </Typography>
          )}

          {/* Actions */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 1,
              p: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button
              color="inherit"
              sx={{ textTransform: "none" }}
              onClick={() => setLocating(false)}
            >
              Quitter
            </Button>
            <Button
              variant="contained"
              disabled={!placement}
              onClick={handleLocate}
              sx={{ textTransform: "none", px: 3 }}
            >
              Positionner
            </Button>
          </Box>
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
