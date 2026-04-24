import { useMemo, useState } from "react";

import { useSelector } from "react-redux";

import {
  Box,
  Typography,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { Download, Upload } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import downloadBlob from "Features/files/utils/downloadBlob";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import createBaseMapShareZip from "../services/createBaseMapShareZip";
import DialogLoadBaseMapShare from "./DialogLoadBaseMapShare";

export default function CardBaseMapShare() {
  // data

  const baseMap = useMainBaseMap();
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const openedPanel = useSelector((s) => s.listings.openedPanel);
  const hideBaseMapAnnotations = openedPanel !== "BASE_MAP_DETAIL";

  const annotations = useAnnotationsV2({
    caller: "CardBaseMapShare",
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
    onlyIsForBaseMapsListings: viewerKey === "BASE_MAPS",
  });

  const annotationIds = useMemo(
    () => (annotations ?? []).map((a) => a.id),
    [annotations]
  );

  // state

  const [openLoad, setOpenLoad] = useState(false);
  const [includeAllVersions, setIncludeAllVersions] = useState(false);

  // handlers

  async function handleDownload() {
    if (!baseMapId) return;
    const file = await createBaseMapShareZip({
      baseMapId,
      annotationIds,
      includeAllVersions,
    });
    downloadBlob(file, file.name);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        Partage
      </Typography>
      <Box
        sx={{
          bgcolor: "action.hover",
          borderRadius: 1,
          mb: 1,
          overflow: "hidden",
        }}
      >
        <ListItemButton onClick={handleDownload} disabled={!baseMap}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Télécharger le fond de plan et les annotations"
            primaryTypographyProps={{ variant: "body2" }}
          />
        </ListItemButton>
        <Box sx={{ pl: 4.5, pr: 1, pb: 1 }}>
          <FormControlLabel
            sx={{ m: 0 }}
            control={
              <Checkbox
                size="small"
                checked={includeAllVersions}
                onChange={(e) => setIncludeAllVersions(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Toutes les versions du fond de plan
              </Typography>
            }
          />
        </Box>
      </Box>
      <ListItemButton
        onClick={() => setOpenLoad(true)}
        disabled={!projectId || !scopeId}
        sx={{ borderRadius: 1 }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Upload fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary="Charger un fond de plan avec annotations"
          primaryTypographyProps={{ variant: "body2" }}
        />
      </ListItemButton>
      <DialogLoadBaseMapShare
        open={openLoad}
        onClose={() => setOpenLoad(false)}
      />
    </WhiteSectionGeneric>
  );
}
