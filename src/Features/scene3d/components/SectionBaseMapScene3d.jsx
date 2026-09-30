import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { openScene3dReloadDialog } from "../scene3dSlice";

import {
  Alert,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import db from "App/db/db";

import { getScene3dDisplay3d } from "../constants/scene3dConstants";
import formatScene3dBytes from "../utils/formatScene3dBytes";

const DISPLAY_3D_OPTIONS = [
  { value: "MESH", label: "Maillage" },
  { value: "PROJECTION", label: "Projection" },
  { value: "HIDDEN", label: "Masqué" },
];

const toggleGroupSx = {
  "& .MuiToggleButton-root": { py: 0.25, px: 1, textTransform: "none" },
};

// « Scène 3D » section of the base map properties (scan base maps only):
//   - display in the 3D editor (textured mesh / base map plane only /
//     nothing over the plane),
//   - scan stats,
//   - scan data status: the heavy data is local to the device, so a base
//     map received through a Krto only has its image until the files are
//     loaded again ("Recharger les fichiers").
// The altitude of the plane is the base map Z (Position 3D).
export default function SectionBaseMapScene3d({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Scène 3D";
  const display3dS = "Affichage 3D";
  const missingS =
    "Les données 3D de ce scan ne sont pas sur cet appareil : seule l'image est affichée.";
  const reloadS = "Recharger les fichiers";

  // data

  const scene3d = baseMap?.scene3d;
  const sceneId = scene3d?.sceneId;
  const display3d = getScene3dDisplay3d(baseMap);

  // index-only count: never reads the binary rows
  const assetsCount = useLiveQuery(
    () =>
      sceneId ? db.scene3dAssets.where("sceneId").equals(sceneId).count() : 0,
    [sceneId]
  );
  const isMissing = assetsCount === 0;

  // helpers

  const zone = scene3d?.zone;
  const infoS = [
    Number.isFinite(scene3d?.faceCount)
      ? `${scene3d.faceCount.toLocaleString("fr-FR")} triangles`
      : null,
    zone ? `${zone.width.toFixed(1)} × ${zone.height.toFixed(1)} m` : null,
    zone && Number.isFinite(zone.zMax - zone.zMin)
      ? `relief ${(zone.zMax - zone.zMin).toFixed(1)} m`
      : null,
    !isMissing && scene3d?.storedBytes
      ? formatScene3dBytes(scene3d.storedBytes)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // handlers

  async function handleDisplay3dChange(_e, next) {
    if (next === null || next === display3d || !baseMap?.id) return;
    await db.baseMaps.update(baseMap.id, {
      scene3d: { ...scene3d, display3d: next },
    });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
  }

  function handleReloadClick() {
    dispatch(openScene3dReloadDialog({ baseMapId: baseMap.id }));
  }

  // render

  if (!scene3d) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
          {scene3d.srcFileName && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {scene3d.srcFileName}
            </Typography>
          )}
          {infoS && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block" }}
            >
              {infoS}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
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
