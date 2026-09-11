import { useDispatch, useSelector } from "react-redux";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";

import { Box, Typography, Button } from "@mui/material";
import { ChevronRight } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldBaseMapOpacity from "./FieldBaseMapOpacity";
import FieldBaseMapOpacityIn3d from "Features/threedEditor/components/FieldBaseMapOpacityIn3d";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useMainBaseMapListing from "Features/baseMaps/hooks/useMainBaseMapListing";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// SectionBaseMapOverview — "Fond de plan" card of the module default panels
// (scope panel, Dessin panel): preview of the MAIN base map, version caption,
// opacity slider and a "Voir le détail" button opening the base map in the
// BASE_MAPS module. `returnFromViewer` is the module the detail comes back to.
// ---------------------------------------------------------------------------

export default function SectionBaseMapOverview({ returnFromViewer = "MAP" }) {
  // strings

  const titleS = "Fond de plan";
  const detailS = "Voir le détail";

  // data

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const mainBaseMapListing = useMainBaseMapListing();

  // The opacity slider drives whichever viewer is on screen, exactly like
  // PanelBaseMapProperties: `baseMap.opacity` (DB, 2D display) in 2D, the
  // session-only 3D state in the 3D family — the two are decoupled and
  // `baseMap.opacity` never reaches the 3D scene.
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const isThreedViewer = isThreedFamilyViewerKey(effectiveViewerKey);

  // helpers

  const baseMapUrl = baseMap?.getUrl?.();

  const activeVersion = baseMap?.getActiveVersion?.();
  const imageSize = baseMap?.getActiveImageSize?.();
  const aspectRatio =
    imageSize?.width && imageSize?.height
      ? (imageSize.width / imageSize.height).toFixed(2)
      : null;
  const fileSizeS = stringifyFileSize(activeVersion?.image?.file?.size);
  const captionParts = activeVersion ? [activeVersion.label || "Version"] : [];
  if (activeVersion && aspectRatio) captionParts.push(`r:${aspectRatio}`);
  if (activeVersion && fileSizeS) captionParts.push(fileSizeS);

  // handlers

  function handleSelectBaseMap() {
    if (!baseMap) return;
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: mainBaseMapListing?.id,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
    dispatch(setSelectedViewerKey("BASE_MAPS"));
    dispatch(setViewerReturnContext({ fromViewer: returnFromViewer }));
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {titleS}
      </Typography>

      {baseMapUrl && (
        <Box
          sx={{
            width: 1,
            height: 140,
            backgroundImage: `url(${baseMapUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        />
      )}

      {captionParts.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          {captionParts.join(" — ")}
        </Typography>
      )}

      {baseMap &&
        (isThreedViewer ? (
          <FieldBaseMapOpacityIn3d baseMap={baseMap} />
        ) : (
          <FieldBaseMapOpacity baseMap={baseMap} />
        ))}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Button
          size="small"
          endIcon={<ChevronRight />}
          onClick={handleSelectBaseMap}
        >
          {detailS}
        </Button>
      </Box>
    </WhiteSectionGeneric>
  );
}
