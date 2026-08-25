import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setShowCalibration,
  setCalibrationTargetVisible,
} from "Features/baseMapEditor/baseMapEditorSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

import db from "App/db/db";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getBaseMapTransform, {
  DEFAULT_ORIENTATION,
} from "Features/baseMaps/js/getBaseMapTransform";
import computeRecalageTransform from "Features/baseMaps/js/computeRecalageTransform";
import {
  DEFAULT_RED,
  DEFAULT_GREEN,
} from "Features/mapEditor/utils/computeCalibrationTransform";

import {
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
} from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import SwitchGeneric from "Features/layout/components/SwitchGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import FieldText from "Features/form/components/FieldText";

const RED = "#e53935";
const GREEN = "#43a047";
const REF_COLOR_OPTIONS = [
  { value: "red", label: "Rouge", color: RED },
  { value: "green", label: "Vert", color: GREEN },
];

export default function PanelBaseMapPositionInMainRef({ baseMap, onBack }) {
  const dispatch = useDispatch();

  // data

  const { value: projectBaseMaps = [] } = useBaseMaps();
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );
  const visible = useSelector((s) => s.baseMapEditor.calibrationTargetVisible);

  // state

  const [selectedRefId, setSelectedRefId] = useState(null);
  // With 2 targets, the reference target anchors the translation and the
  // other one only drives the rotation (see computeRecalageTransform).
  const [refColor, setRefColor] = useState("red");

  // helpers

  const otherBaseMaps = projectBaseMaps.filter((b) => b.id !== baseMap?.id);
  const transform = baseMap ? getBaseMapTransform(baseMap) : null;
  const heightValue = transform ? String(transform.position.y ?? 0) : "0";
  const orientation = transform?.orientation ?? DEFAULT_ORIENTATION;
  const twoTargets = Boolean(visible.red && visible.green);

  // effects — show the draggable calibration targets on the current baseMap
  // while this panel is open (reuses CalibrationLayer in the 2D editor).

  useEffect(() => {
    dispatch(setShowCalibration(true));
    return () => dispatch(setShowCalibration(false));
  }, [dispatch]);

  // handlers

  function handleToggleTarget(color, checked) {
    dispatch(setCalibrationTargetVisible({ color, visible: checked }));
  }

  // Orientation of the plane in the 3D scene: HORIZONTAL = laid flat as a
  // floor, VERTICAL = stood up as a wall, PHOTO = perspective photo (not a
  // plane: its 3D presence is its calibrated photoPlans). Same fields as the
  // 3D viewer's "Rotation" section (SectionsBaseMapTransform3D), edited here
  // from the 2D editors where the scene is not mounted.
  async function handleOrientationChange(value) {
    const displayed = baseMap?.isPhoto ? "PHOTO" : orientation;
    if (!baseMap?.id || !value || value === displayed) return;
    if (value === "PHOTO") {
      await db.baseMaps.update(baseMap.id, { isPhoto: true });
    } else {
      await db.baseMaps.update(baseMap.id, {
        orientation: value,
        isPhoto: false,
      });
    }
    dispatch(triggerBaseMapsUpdate());
  }

  async function handleHeightChange(raw) {
    if (!baseMap?.id) return;
    const y = parseFloat(raw);
    if (!Number.isFinite(y)) return;
    const t = getBaseMapTransform(baseMap);
    await db.baseMaps.update(baseMap.id, {
      position: { ...t.position, y },
    });
    dispatch(triggerBaseMapsUpdate());
  }

  async function handleRecaler() {
    if (!baseMap?.id || !selectedRefId) return;
    const refBaseMap = otherBaseMaps.find((b) => b.id === selectedRefId);
    if (!refBaseMap) return;

    const currentVersionId = baseMap.getActiveVersion?.()?.id;
    const refVersionId = refBaseMap.getActiveVersion?.()?.id;

    const currentTargets = calibrationTargetsByVersionId[currentVersionId] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };
    const refTargets = calibrationTargetsByVersionId[refVersionId] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };

    const result = computeRecalageTransform({
      currentBaseMap: baseMap,
      refBaseMap,
      currentTargets,
      refTargets,
      useRed: visible.red,
      useGreen: visible.green,
      refColor,
    });

    if (!result) {
      dispatch(
        setToaster({
          message: "Recalage impossible (cibles ou tailles manquantes)",
          isError: true,
        })
      );
      return;
    }

    const update = { position: result.position };
    if (twoTargets) update.angleDeg = result.angleDeg;

    await db.baseMaps.update(baseMap.id, update);
    dispatch(triggerBaseMapsUpdate());

    dispatch(
      setToaster({
        message: twoTargets
          ? "Fond de plan recalé (position + rotation)"
          : "Fond de plan recalé (position)",
      })
    );
  }

  // render

  if (!baseMap) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={onBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Fond de plan
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            Position 3D
          </Typography>
        </Box>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1.5 }}>
        {/* Orientation */}
        <WhiteSectionGeneric>
          <Box sx={{ p: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Orientation du plan
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={baseMap?.isPhoto ? "PHOTO" : orientation}
                onChange={(_e, v) => handleOrientationChange(v)}
              >
                <ToggleButton
                  value="HORIZONTAL"
                  sx={{ textTransform: "none", py: 0.25 }}
                >
                  Horizontal
                </ToggleButton>
                <ToggleButton
                  value="VERTICAL"
                  sx={{ textTransform: "none", py: 0.25 }}
                >
                  Vertical
                </ToggleButton>
                <ToggleButton
                  value="PHOTO"
                  sx={{ textTransform: "none", py: 0.25 }}
                >
                  Photo
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        </WhiteSectionGeneric>

        {/* Targets */}
        <WhiteSectionGeneric>
          <Box sx={{ p: 0.5 }}>
            <SwitchGeneric
              label="Cible verte"
              checked={visible.green}
              onChange={(c) => handleToggleTarget("green", c)}
            />
            <SwitchGeneric
              label="Cible rouge"
              checked={visible.red}
              onChange={(c) => handleToggleTarget("red", c)}
            />
            {twoTargets && (
              <Box sx={{ px: 1, pt: 0.5, pb: 1 }}>
                <Typography variant="caption" color="text.secondary" noWrap>
                  Point de référence
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={refColor}
                  onChange={(_e, v) => v && setRefColor(v)}
                  sx={{ display: "flex", mt: 0.5 }}
                >
                  {REF_COLOR_OPTIONS.map((option) => (
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
            )}
          </Box>
        </WhiteSectionGeneric>

        {/* Recaler */}
        <WhiteSectionGeneric>
          <Box sx={{ p: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: "bold" }}
            >
              Recaler par rapport à
            </Typography>
            {otherBaseMaps.length === 0 ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1 }}
              >
                Aucun autre fond de plan.
              </Typography>
            ) : (
              <List
                dense
                disablePadding
                sx={{ maxHeight: 180, overflowY: "auto", mt: 0.5 }}
              >
                {otherBaseMaps.map((map) => (
                  <ListItem key={map.id} disablePadding>
                    <ListItemButton
                      selected={map.id === selectedRefId}
                      onClick={() => setSelectedRefId(map.id)}
                      sx={{ py: 0.25, borderRadius: 1 }}
                    >
                      <ListItemText
                        primary={map.name}
                        primaryTypographyProps={{
                          variant: "body2",
                          noWrap: true,
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
          <ButtonInPanelV2
            label="Recaler"
            variant="contained"
            disabled={!selectedRefId || (!visible.red && !visible.green)}
            onClick={handleRecaler}
          />
        </WhiteSectionGeneric>

        {/* Height */}
        <WhiteSectionGeneric>
          <Box sx={{ p: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Hauteur (m)
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <FieldText
                value={heightValue}
                onChange={handleHeightChange}
                options={{ fullWidth: true }}
              />
            </Box>
          </Box>
        </WhiteSectionGeneric>
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
