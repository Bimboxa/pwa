import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import BaseMapTree from "./BaseMapTree";
import PanelBaseMapVersions from "./PanelBaseMapVersions";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

// ---------------------------------------------------------------------------
// PanelBaseMaps — left panel of the Fond de plan module (#312): the folders /
// base maps tree, swapping to a base map detail subview (versions list or
// base map properties) when a base map row is clicked — same navigation
// pattern as the Dessin panel (#311).
// ---------------------------------------------------------------------------

export default function PanelBaseMaps() {
  // strings

  const titleS = "Fonds de plan";
  const descriptionS =
    "Organisez vos plans par dossier. Glissez une ligne pour la déplacer, " +
    "chaque fond conserve l'historique de ses versions.";

  // data

  const detailBaseMapId = useSelector((s) => s.baseMapEditor.detailBaseMapId);
  const { value: baseMaps } = useBaseMaps();

  // helpers - detail view (#312). A stale id (deleted base map, project
  // change) simply resolves to nothing and the tree renders.

  const detailBaseMap = detailBaseMapId
    ? (baseMaps ?? []).find((bm) => bm.id === detailBaseMapId)
    : null;

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
          <LeftDrawerPanelHeader title={titleS} />
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
