/* eslint-disable react/prop-types */
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setBaseMapsScanMode } from "Features/viewers/viewersSlice";

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
import { BASE_MAPS_SCAN_MODE_OPTIONS } from "Features/baseMaps/constants/baseMapsScanMode";

const toggleGroupSx = {
  "& .MuiToggleButton-root": { py: 0.25, px: 1, textTransform: "none" },
};

// « Scan 3D » section of the base map properties (base maps projected from a
// local point cloud): the source scan, its file status on this device and
// the 3D display mode — the global one of the bottom bar, shared by every
// scan base map of the Krto. The point cloud follows the base map pose.
export default function SectionBaseMapLocalScan({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Scan 3D";
  const display3dS = "Affichage 3D";
  const deletedS = "Le scan source a été supprimé des ressources du projet.";
  const missingS =
    "Le fichier du scan n'est pas sur cet appareil : seule l'image est affichée.";
  const resourcesS = "Ouvrir les ressources";

  // data

  const resourceId = baseMap?.localScan?.resourceId;
  const scanMode = useSelector((s) => s.viewers.baseMapsScanMode);
  const status = useLiveQuery(async () => {
    if (!resourceId) return null;
    const resource = await db.resources.get(resourceId);
    if (!resource || resource.deletedAt) return { deleted: true };
    const file = await db.files.get(resource.fileName);
    return {
      resource,
      missing: !(file?.fileBlob || file?.fileArrayBuffer),
    };
  }, [resourceId]);

  // helpers

  const resource = status?.resource;
  const infoS = resource
    ? [
        resource.scan?.count
          ? `${resource.scan.count.toLocaleString("fr-FR")} ${resource.scan.kind === "SPLAT" ? "gaussiennes" : "points"}`
          : null,
        baseMap.createdFrom?.type === "LOCAL_SCAN" &&
        Number.isFinite(baseMap.createdFrom.lower)
          ? `tranche Z ${baseMap.createdFrom.lower.toFixed(2)} à ${baseMap.createdFrom.upper.toFixed(2)} m`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  // render

  if (!resourceId) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
          {resource?.name && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {resource.name}
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
            value={scanMode}
            exclusive
            onChange={(_, next) => next && dispatch(setBaseMapsScanMode(next))}
            size="small"
            sx={toggleGroupSx}
          >
            {BASE_MAPS_SCAN_MODE_OPTIONS.map((o) => (
              <ToggleButton key={o.key} value={o.key}>
                {o.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {status?.deleted && <Alert severity="info">{deletedS}</Alert>}
        {status?.missing && (
          <>
            <Alert severity="info">{missingS}</Alert>
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <ButtonGeneric
                label={resourcesS}
                size="small"
                variant="contained"
                color="secondary"
                onClick={() => dispatch(setSelectedMenuItemKey("RESOURCES"))}
              />
            </Box>
          </>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
