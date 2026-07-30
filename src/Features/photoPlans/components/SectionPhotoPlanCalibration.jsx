import { useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCalibrationTargets } from "Features/baseMapEditor/baseMapEditorSlice";
import { triggerPhotoPlansUpdate } from "../photoPlansSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  alpha,
  Box,
  Button,
  Chip,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import db from "App/db/db";

import ElevationBaseMapViewer from "Features/elevation/components/ElevationBaseMapViewer";
import {
  FUITE_U_COLOR,
  FUITE_V_COLOR,
  COTE_COLOR,
} from "./VanishingLinesLayer";

import usePhotoPlans from "../hooks/usePhotoPlans";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import computePhotoPlanCalibrationFromBaseMaps from "../utils/computePhotoPlanCalibrationFromBaseMaps";
import {
  DEFAULT_RED,
  DEFAULT_GREEN,
} from "Features/mapEditor/utils/computeCalibrationTransform";

const RED = "#e53935";
const GREEN = "#43a047";

// Default vanishing-line segments (normalized): 2 quasi-horizontal for the U
// family, 2 quasi-vertical for the V family. The user only drags endpoints —
// there is no drawing mode. Positionner stays blocked until they moved.
const defaultVanishingLines = () => ({
  u: [
    { id: "u1", p1: { x: 0.2, y: 0.35 }, p2: { x: 0.8, y: 0.35 } },
    { id: "u2", p1: { x: 0.2, y: 0.65 }, p2: { x: 0.8, y: 0.65 } },
  ],
  v: [
    { id: "v1", p1: { x: 0.35, y: 0.2 }, p2: { x: 0.35, y: 0.8 } },
    { id: "v2", p1: { x: 0.65, y: 0.2 }, p2: { x: 0.65, y: 0.8 } },
  ],
});

const linesEqualDefaults = (lines) => {
  const d = defaultVanishingLines();
  const eq = (a, b) =>
    a.length === b.length &&
    a.every(
      (s, i) =>
        s.p1.x === b[i].p1.x &&
        s.p1.y === b[i].p1.y &&
        s.p2.x === b[i].p2.x &&
        s.p2.y === b[i].p2.y
    );
  return eq(lines.u ?? [], d.u) && eq(lines.v ?? [], d.v);
};

// Same per-VERSION keying as the pastilles redux map (see
// PanelElevationLocateBaseMap.getTargetsKey).
function getTargetsKey(baseMap) {
  if (!baseMap) return null;
  return baseMap.getActiveVersion?.()?.id ?? baseMap.id;
}

const ERROR_MESSAGES = {
  VP_U_DEGENERATE:
    "Lignes de fuite U (bleues) inexploitables : 2 segments non alignés requis.",
  VP_V_DEGENERATE:
    "Lignes de fuite V (oranges) inexploitables : 2 segments non alignés requis.",
  NEEDS_FOCAL:
    "Photo prise à niveau (lignes V parallèles) : renseignez la focale équiv. 35 mm ci-dessous, ou inclinez la prise de vue.",
  FOCAL_DEGENERATE:
    "Points de fuite incohérents avec deux directions perpendiculaires — ajustez les lignes de fuite.",
  VPS_TOO_CLOSE:
    "Les deux familles de lignes convergent vers le même point — directions trop proches.",
  TARGETS_SUPERIMPOSED:
    "Les pastilles doivent être distinctes sur la vue en plan.",
  PHOTO_TARGETS_SUPERIMPOSED:
    "Les pastilles doivent être distinctes sur la photo.",
  TARGETS_SAME_U:
    "Les deux pastilles sont à la même abscisse sur le plan — écartez-les horizontalement.",
  TARGET_ON_HORIZON: "Une pastille est sur la ligne d'horizon — déplacez-la.",
  REF_HEIGHT_REQUIRED: "Saisissez la hauteur du point de référence.",
  COTE_LENGTH_REQUIRED: "Saisissez la longueur réelle de la cote connue.",
  COTE_DEGENERATE:
    "Les extrémités de la cote connue sont confondues — écartez-les.",
  COTE_ON_HORIZON:
    "Une extrémité de la cote connue est sur la ligne d'horizon — déplacez-la.",
};

// Default known-dimension segment (normalized) when the user arms the cote.
const DEFAULT_COTE_SEGMENT = () => ({
  p1: { x: 0.4, y: 0.5 },
  p2: { x: 0.6, y: 0.5 },
});

// Photo branch of the Élévation tool (BASE_MAPS module): select a photoPlan
// (chips band), place the 2 pastilles (photo below + plan view in the 2D
// editor, redux mechanism shared with the vertical flow) and adjust the two
// vanishing-line families, then "Positionner" computes the homography + world
// pose and persists EVERYTHING on the photoPlan record (re-editable).
export default function SectionPhotoPlanCalibration({
  baseMap,
  locating,
  onQuit,
}) {
  const dispatch = useDispatch();

  // data

  const { value: photoPlans = [] } = usePhotoPlans({ baseMapId: baseMap?.id });
  const planBaseMap = useMainBaseMap();
  const targetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );

  // state

  const [selectedPhotoPlanId, setSelectedPhotoPlanId] = useState(null);
  const [vanishingLines, setVanishingLines] = useState(defaultVanishingLines);
  const [refColor, setRefColor] = useState("green");
  const [refHeightStr, setRefHeightStr] = useState("");
  const [focal35Str, setFocal35Str] = useState("");
  // Optional known dimension on the photo: {p1, p2} | null + its real length.
  const [coteSegment, setCoteSegment] = useState(null);
  const [coteLengthStr, setCoteLengthStr] = useState("");

  // helpers

  const photoPlan =
    photoPlans.find((p) => p.id === selectedPhotoPlanId) ?? null;

  const photoKey = getTargetsKey(baseMap);
  const planKey = getTargetsKey(planBaseMap);
  const photoTargets = photoKey
    ? (targetsByVersionId[photoKey] ?? {
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

  const planIsUsable =
    Boolean(planBaseMap) &&
    planBaseMap.id !== baseMap?.id &&
    planBaseMap.orientation !== "VERTICAL" &&
    !planBaseMap.isPhoto;

  const imageSize = baseMap?.getImageSize?.();
  const refHeight = refHeightStr
    ? parseFloat(String(refHeightStr).replace(",", "."))
    : photoPlan?.orientation === "HORIZONTAL"
      ? 0
      : NaN;
  const focal35 = focal35Str
    ? parseFloat(String(focal35Str).replace(",", "."))
    : null;
  const focalPxOverride =
    Number.isFinite(focal35) && focal35 > 0 && imageSize?.width
      ? (focal35 * imageSize.width) / 36
      : null;

  const linesAreDefault = useMemo(
    () => linesEqualDefaults(vanishingLines),
    [vanishingLines]
  );

  const coteLengthM = coteLengthStr
    ? parseFloat(String(coteLengthStr).replace(",", "."))
    : NaN;
  const knownCote = coteSegment
    ? { p1: coteSegment.p1, p2: coteSegment.p2, lengthM: coteLengthM }
    : null;

  // Live compute (closed-form, < 1ms): drives the disabled reason, the
  // diagnostics display and the Positionner button.
  const result =
    locating && photoPlan && planIsUsable && !linesAreDefault
      ? computePhotoPlanCalibrationFromBaseMaps({
          photoBaseMap: baseMap,
          photoPlan,
          planBaseMap,
          planTargets,
          photoTargets,
          uSegments: vanishingLines.u,
          vSegments: vanishingLines.v,
          refColor,
          refHeight,
          focalPxOverride,
          knownCote,
        })
      : null;

  // effect — default to the first photoPlan

  useEffect(() => {
    if (
      photoPlans.length > 0 &&
      !photoPlans.some((p) => p.id === selectedPhotoPlanId)
    ) {
      setSelectedPhotoPlanId(photoPlans[0].id);
    }
  }, [photoPlans, selectedPhotoPlanId]);

  // effect — seed the edit state from a previously calibrated photoPlan
  // (this is what makes the calibration re-editable).

  useEffect(() => {
    const inputs = photoPlan?.calibrationInputs;
    if (!inputs) {
      setVanishingLines(defaultVanishingLines());
      setRefColor("green");
      setRefHeightStr("");
      setFocal35Str("");
      setCoteSegment(null);
      setCoteLengthStr("");
      return;
    }
    setVanishingLines({
      u: inputs.uSegments ?? defaultVanishingLines().u,
      v: inputs.vSegments ?? defaultVanishingLines().v,
    });
    setRefColor(inputs.refColor ?? "green");
    setRefHeightStr(
      Number.isFinite(inputs.refHeight) ? String(inputs.refHeight) : ""
    );
    setFocal35Str(
      Number.isFinite(inputs.focalPxOverride) && imageSize?.width
        ? String(
            Math.round(((inputs.focalPxOverride * 36) / imageSize.width) * 10) /
              10
          )
        : ""
    );
    if (photoKey && inputs.photoTargets) {
      dispatch(
        setCalibrationTargets({ versionId: photoKey, ...inputs.photoTargets })
      );
    }
    if (
      inputs.planTargets &&
      planKey &&
      planBaseMap?.id === inputs.planBaseMapId
    ) {
      dispatch(
        setCalibrationTargets({ versionId: planKey, ...inputs.planTargets })
      );
    }
    if (inputs.knownCote?.p1 && inputs.knownCote?.p2) {
      setCoteSegment({ p1: inputs.knownCote.p1, p2: inputs.knownCote.p2 });
      setCoteLengthStr(
        Number.isFinite(inputs.knownCote.lengthM)
          ? String(inputs.knownCote.lengthM)
          : ""
      );
    } else {
      setCoteSegment(null);
      setCoteLengthStr("");
    }
  }, [photoPlan?.id]);

  // handlers

  function handlePhotoTargetsChange(nextTargets) {
    if (!photoKey) return;
    dispatch(setCalibrationTargets({ versionId: photoKey, ...nextTargets }));
  }

  function handleMoveFuiteEndpoint({ family, segmentId, end, point }) {
    if (family === "cote") {
      setCoteSegment((prev) => (prev ? { ...prev, [end]: point } : prev));
      return;
    }
    setVanishingLines((prev) => ({
      ...prev,
      [family]: prev[family].map((seg) =>
        seg.id === segmentId ? { ...seg, [end]: point } : seg
      ),
    }));
  }

  async function handlePositionner() {
    if (!result?.ok || !photoPlan) return;
    const calibrationInputs = {
      uSegments: vanishingLines.u,
      vSegments: vanishingLines.v,
      photoTargets,
      planTargets,
      planBaseMapId: planBaseMap.id,
      refColor,
      refHeight: Number.isFinite(refHeight) ? refHeight : null,
      ...(focalPxOverride && { focalPxOverride }),
      knownCote:
        coteSegment && Number.isFinite(coteLengthM) && coteLengthM > 0
          ? { p1: coteSegment.p1, p2: coteSegment.p2, lengthM: coteLengthM }
          : null,
    };
    const calibration = {
      ok: true,
      H: result.H,
      Hinv: result.Hinv,
      pose: result.pose,
      imageSize: result.imageSize,
      horizonLine: result.horizonLine,
      diagnostics: result.diagnostics,
      computedAt: new Date().toISOString(),
    };
    await db.photoPlans.update(photoPlan.id, {
      calibrationInputs,
      calibration,
    });
    dispatch(triggerPhotoPlansUpdate());
    dispatch(setToaster({ message: "Plan photo positionné" }));
  }

  // helpers — render

  const disabledReason = !locating
    ? null
    : !photoPlan
      ? "Sélectionnez un plan photo (ou créez-en un depuis les propriétés d'un polygone dessiné sur la photo)."
      : !planIsUsable
        ? "Affichez la vue en plan dans l'éditeur 2D (sélectionnez un fond de plan horizontal, non photo, dans l'arborescence)."
        : linesAreDefault
          ? "Ajustez les lignes de fuite (bleues = direction U, oranges = direction V) sur des lignes réelles de la photo."
          : photoPlan.orientation === "VERTICAL" && !Number.isFinite(refHeight)
            ? "Saisissez la hauteur du point de référence."
            : result && !result.ok
              ? (ERROR_MESSAGES[result.errorCode] ??
                `Calibration impossible (${result.errorCode}).`)
              : !result
                ? "Données insuffisantes pour calculer la calibration."
                : null;

  const diag = result?.ok ? result.diagnostics : null;
  const showFocalField =
    locating && (result?.errorCode === "NEEDS_FOCAL" || Boolean(focal35Str));

  const qualityChip = (label, valueDeg, warnAt, badAt) => {
    if (!Number.isFinite(valueDeg)) return null;
    const color =
      valueDeg >= badAt ? "error" : valueDeg >= warnAt ? "warning" : "success";
    return (
      <Chip
        key={label}
        size="small"
        variant="outlined"
        color={color}
        label={`${label} ${valueDeg.toFixed(1)}°`}
      />
    );
  };

  // render

  return (
    <>
      {/* PhotoPlans chips band */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          flexWrap: "wrap",
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Plans photo
        </Typography>
        {photoPlans.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            Aucun — dessinez un polygone sur la photo puis créez le plan depuis
            ses propriétés.
          </Typography>
        ) : (
          photoPlans.map((p) => {
            const sel = p.id === selectedPhotoPlanId;
            return (
              <Chip
                key={p.id}
                size="small"
                label={`${p.name}${p.calibration?.ok ? " ✓" : ""}`}
                color={sel ? "primary" : "default"}
                variant={sel ? "filled" : "outlined"}
                onClick={() => setSelectedPhotoPlanId(p.id)}
              />
            );
          })
        )}
      </Box>

      <ElevationBaseMapViewer
        baseMapId={baseMap?.id}
        targets={locating ? photoTargets : null}
        vanishingLines={locating && photoPlan ? vanishingLines : null}
        knownCote={locating && photoPlan ? coteSegment : null}
        onTargetsChange={handlePhotoTargetsChange}
        onMoveFuiteEndpoint={handleMoveFuiteEndpoint}
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
                {"Placez les pastilles "}
                <Box component="span" sx={{ color: GREEN, fontWeight: 700 }}>
                  verte
                </Box>
                {" et "}
                <Box component="span" sx={{ color: RED, fontWeight: 700 }}>
                  rouge
                </Box>
                {
                  " sur deux points reconnaissables du plan photo, d'abord dans la vue en plan (éditeur 2D), puis sur la photo ci-dessus."
                }
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {"Alignez ensuite les lignes de fuite "}
                <Box
                  component="span"
                  sx={{ color: FUITE_U_COLOR, fontWeight: 700 }}
                >
                  bleues
                </Box>
                {" sur des lignes réelles de la 1ʳᵉ direction du plan et les "}
                <Box
                  component="span"
                  sx={{ color: FUITE_V_COLOR, fontWeight: 700 }}
                >
                  oranges
                </Box>
                {
                  " sur la 2ᵉ direction (verticales d'une façade), en déplaçant leurs extrémités."
                }
              </Typography>
            </Box>
          </Box>

          {/* Reference point + height + focal override */}
          <Box
            sx={{
              display: "flex",
              alignItems: "flex-end",
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
                      sx={{ fontWeight: refColor === option.value ? 700 : 400 }}
                    >
                      {option.label}
                    </Typography>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            {photoPlan?.orientation === "VERTICAL" && (
              <TextField
                size="small"
                label="Hauteur réf. (m)"
                value={refHeightStr}
                onChange={(e) => setRefHeightStr(e.target.value)}
                sx={{ width: 130 }}
              />
            )}

            {showFocalField && (
              <TextField
                size="small"
                label="Focale (équiv. 35 mm)"
                value={focal35Str}
                onChange={(e) => setFocal35Str(e.target.value)}
                sx={{ width: 160 }}
              />
            )}
          </Box>

          {/* Known dimension ("cote connue") — drives the metric scale
              instead of the pastille spacing when set. */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1.5,
              pb: 1,
              flexWrap: "wrap",
            }}
          >
            {!coteSegment ? (
              <Chip
                size="small"
                variant="outlined"
                icon={<AddIcon sx={{ fontSize: 14 }} />}
                label="Cote connue"
                sx={{ "& .MuiChip-icon": { color: COTE_COLOR } }}
                onClick={() => {
                  setCoteSegment(DEFAULT_COTE_SEGMENT());
                }}
              />
            ) : (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                  }}
                >
                  <Box
                    sx={{
                      width: 18,
                      height: 3,
                      borderRadius: 1,
                      bgcolor: COTE_COLOR,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" noWrap>
                    Cote connue sur la photo
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  label="Longueur (m)"
                  value={coteLengthStr}
                  onChange={(e) => setCoteLengthStr(e.target.value)}
                  sx={{ width: 120 }}
                />
                <Tooltip title="Retirer la cote (l'échelle reviendra à la distance entre pastilles)">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setCoteSegment(null);
                      setCoteLengthStr("");
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>

          {/* Quality diagnostics */}
          {diag && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 0.5,
                px: 1.5,
                pb: 1,
              }}
            >
              {qualityChip("Résidu U", diag.vpUResidualDeg, 1, 3)}
              {qualityChip("Résidu V", diag.vpVResidualDeg, 1, 3)}
              {Number.isFinite(diag.focal35) && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    diag.focal35 < 12 || diag.focal35 > 200
                      ? "warning"
                      : "default"
                  }
                  label={`Focale ~${Math.round(diag.focal35)} mm`}
                />
              )}
              {diag.scaleSource === "cote" && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    diag.warnings?.includes("SCALE_MISMATCH")
                      ? "warning"
                      : "success"
                  }
                  label={`Échelle : cote — pastilles ${
                    Number.isFinite(diag.targetsSpacingM)
                      ? diag.targetsSpacingM.toFixed(2)
                      : "?"
                  } m (plan ${
                    Number.isFinite(diag.planTargetsDistanceM)
                      ? diag.planTargetsDistanceM.toFixed(2)
                      : "?"
                  } m)`}
                />
              )}
              {Number.isFinite(diag.otherTargetV) && (
                <Typography variant="caption" color="text.secondary">
                  Hauteur calculée de la 2ᵉ pastille :{" "}
                  {diag.otherTargetV.toFixed(2)} m
                </Typography>
              )}
            </Box>
          )}

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
              onClick={onQuit}
            >
              Quitter
            </Button>
            <Button
              variant="contained"
              disabled={!result?.ok}
              onClick={handlePositionner}
              sx={{ textTransform: "none", px: 3 }}
            >
              Positionner
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}
