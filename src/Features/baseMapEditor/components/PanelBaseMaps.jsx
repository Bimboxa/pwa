import { useDispatch, useSelector } from "react-redux";

import { setDisplayedBaseMapListingId } from "../baseMapEditorSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import BaseMapTree from "./BaseMapTree";
import PanelBaseMapVersions from "./PanelBaseMapVersions";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useCreateBaseMapListing from "../hooks/useCreateBaseMapListing";

// ---------------------------------------------------------------------------
// PanelBaseMaps — left panel of the Fond de plan module (#312): the folders /
// base maps tree, swapping to a base map detail subview (versions list or
// base map properties) when a base map row is clicked — same navigation
// pattern as the Dessin panel (#311).
// ---------------------------------------------------------------------------

export default function PanelBaseMaps() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Fonds de plan";
  const newListingS = "Nouveau dossier de fond de plan";
  const descriptionS =
    "Organisez vos plans par dossier. Glissez une ligne pour la déplacer, " +
    "chaque fond conserve l'historique de ses versions.";

  // data

  const detailBaseMapId = useSelector((s) => s.baseMapEditor.detailBaseMapId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps();
  const listings = useProjectBaseMapListings();
  const createListing = useCreateBaseMapListing();

  // helpers - detail view (#312). A stale id (deleted base map, project
  // change) simply resolves to nothing and the tree renders.

  const detailBaseMap = detailBaseMapId
    ? (baseMaps ?? []).find((bm) => bm.id === detailBaseMapId)
    : null;

  // handlers

  async function handleCreateListing() {
    const listing = await createListing({
      projectId,
      title: `Fonds de plan ${(listings?.length || 0) + 1}`,
    });
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedMainBaseMapId(null));
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {detailBaseMap ? (
        <PanelBaseMapVersions baseMap={detailBaseMap} />
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              pr: 1,
            }}
          >
            <LeftDrawerPanelHeader title={titleS} />
            <Tooltip title={newListingS}>
              <IconButton
                size="small"
                color="secondary"
                onClick={handleCreateListing}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography
            variant="caption"
            sx={{ px: 2, pb: 1, color: "text.secondary" }}
          >
            {descriptionS}
          </Typography>
          <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <BaseMapTree />
          </Box>
        </>
      )}
    </Box>
  );
}
