import { useEffect, useState } from "react";

import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import { openScene3dImportDialog } from "../scene3dSlice";

import {
  Alert,
  Box,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import db from "App/db/db";

import {
  getScene3dDisplay2d,
  getScene3dDisplay3d,
} from "../constants/scene3dConstants";
import formatScene3dBytes from "../utils/formatScene3dBytes";

const DISPLAY_2D_OPTIONS = [
  { value: "PROJECTION", label: "Projection" },
  { value: "HIDDEN", label: "Masqué" },
];

const DISPLAY_3D_OPTIONS = [
  { value: "MESH", label: "Maillage" },
  { value: "PROJECTION", label: "Projection" },
  { value: "HIDDEN", label: "Masqué" },
];

const toggleGroupSx = {
  "& .MuiToggleButton-root": { py: 0.25, px: 1, textTransform: "none" },
};

// Per-annotation options of a SCENE_3D (3D scan), in the properties panel:
//   - display in the 2D editor (top-down projection / hidden),
//   - display in the 3D editor (textured mesh / flat projection / hidden),
//   - altitude of its lowest point above the base map (offsetZ),
//   - scan data status: the heavy data is local to the device, so an
//     annotation received through a Krto only has its projection until the
//     files are loaded again ("Recharger les fichiers").
export default function FieldAnnotationScene3dDisplay({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const display2dS = "Affichage 2D";
  const display3dS = "Affichage 3D";
  const altitudeS = "Altitude";
  const missingS =
    "Les données 3D de cette scène ne sont pas sur cet appareil : seule la projection est affichée.";
  const reloadS = "Recharger les fichiers";

  // data

  const scene3d = annotation?.scene3d;
  const sceneId = scene3d?.sceneId;
  const display2d = getScene3dDisplay2d(annotation);
  const display3d = getScene3dDisplay3d(annotation);
  const offsetZ = Number(annotation?.offsetZ) || 0;

  // index-only count: never reads the binary rows
  const assetsCount = useLiveQuery(
    () =>
      sceneId ? db.scene3dAssets.where("sceneId").equals(sceneId).count() : 0,
    [sceneId]
  );
  const isMissing = assetsCount === 0;

  // state — altitude typed locally, written on blur / Enter

  const [altitudeText, setAltitudeText] = useState(String(offsetZ));
  useEffect(() => {
    setAltitudeText(String(offsetZ));
  }, [offsetZ, annotation?.id]);

  // helpers

  const bbox = scene3d?.bbox;
  const infoS = [
    Number.isFinite(scene3d?.faceCount)
      ? `${scene3d.faceCount.toLocaleString("fr-FR")} triangles`
      : null,
    bbox?.min && bbox?.max
      ? `${Math.round(bbox.max[0] - bbox.min[0])} × ${Math.round(bbox.max[1] - bbox.min[1])} m`
      : null,
    !isMissing && scene3d?.storedBytes
      ? formatScene3dBytes(scene3d.storedBytes)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // handlers

  async function update(patch) {
    if (!annotation?.id) return;
    await db.annotations.update(annotation.id, patch);
    dispatch(triggerAnnotationsUpdate());
  }

  function handleDisplay2dChange(_e, next) {
    if (next === null || next === display2d) return;
    update({ sceneDisplay2d: next });
  }

  function handleDisplay3dChange(_e, next) {
    if (next === null || next === display3d) return;
    update({ sceneDisplay3d: next });
  }

  function commitAltitude() {
    const next = Number(String(altitudeText).replace(",", "."));
    if (!Number.isFinite(next)) {
      setAltitudeText(String(offsetZ));
      return;
    }
    if (next !== offsetZ) update({ offsetZ: next });
  }

  function handleReloadClick() {
    dispatch(openScene3dImportDialog({ annotationId: annotation.id }));
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {scene3d?.srcFileName && (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
              {scene3d.srcFileName}
            </Typography>
            {infoS && (
              <Typography variant="caption" color="text.secondary">
                {infoS}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {display2dS}
          </Typography>
          <ToggleButtonGroup
            value={display2d}
            exclusive
            onChange={handleDisplay2dChange}
            size="small"
            sx={toggleGroupSx}
          >
            {DISPLAY_2D_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {display3dS}
          </Typography>
          <ToggleButtonGroup
            value={display3d}
            exclusive
            onChange={handleDisplay3dChange}
            size="small"
            sx={toggleGroupSx}
          >
            {DISPLAY_3D_OPTIONS.map((o) => (
              <ToggleButton key={o.value} value={o.value}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
            {altitudeS}
          </Typography>
          <TextField
            size="small"
            value={altitudeText}
            onChange={(e) => setAltitudeText(e.target.value)}
            onBlur={commitAltitude}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              e.stopPropagation();
            }}
            sx={{ width: 110 }}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              },
            }}
          />
        </Box>

        {isMissing && <Alert severity="info">{missingS}</Alert>}

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <ButtonGeneric
            label={reloadS}
            size="small"
            variant={isMissing ? "contained" : "text"}
            color={isMissing ? "secondary" : "inherit"}
            onClick={handleReloadClick}
          />
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
