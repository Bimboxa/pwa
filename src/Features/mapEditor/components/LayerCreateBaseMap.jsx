import { useDispatch, useSelector } from "react-redux";

import {
  setShowCreateBaseMapSection,
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setCreatingInListingId } from "Features/baseMapEditor/baseMapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useListingById from "Features/listings/hooks/useListingById";

import { Box } from "@mui/material";

import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";

// Single host of the "create a base map" fullscreen section. Mounted by
// SectionViewer as an overlay of the editors area, so it covers whichever
// editor is displayed (2D map editors AND the 3D editor — the 2D editors slide
// off-screen in 3D, which is why the section can't live inside them).
//
// Two triggers:
// - s.baseMapEditor.creatingInListingId — "+" of a listing in the Fonds de
//   plan module tree (BASE_MAPS module only, target listing forced).
// - s.mapEditor.showCreateBaseMapSection — topbar chips "+", and the
//   auto-open of a project without any base map (no close button then).
export default function LayerCreateBaseMap() {
  const dispatch = useDispatch();

  // data

  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveKey = useSelector(selectEffectiveViewerKey);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const showSection = useSelector((s) => s.mapEditor.showCreateBaseMapSection);
  const creatingInListingId = useSelector(
    (s) => s.baseMapEditor.creatingInListingId
  );
  const creatingListing = useListingById(creatingInListingId);

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } =
    useBaseMaps({ filterByProjectId: projectId }) ?? {};

  // helpers

  // The flag stays raised for a project without any base map (set by the
  // always-mounted MAP editor): only overlay the plan editors, never the
  // Table / Portfolio / Scope / Admin viewers.
  const isPlanEditorDisplayed =
    effectiveKey === "MAP" ||
    effectiveKey === "BASE_MAPS" ||
    (isThreedFamilyViewerKey(effectiveKey) && !disable3D);

  const isCreatingInListing =
    Boolean(creatingInListingId) && viewerKey === "BASE_MAPS";

  const show = isPlanEditorDisplayed && (isCreatingInListing || showSection);

  // handlers

  function handleCloseCreatingInListing() {
    dispatch(setCreatingInListingId(null));
  }

  function handleCreatedInListing(entity) {
    dispatch(setSelectedMainBaseMapId(entity?.id));
    dispatch(setSelectedBaseMapsListingId(creatingInListingId));
    dispatch(
      setSelectedItem({
        id: entity?.id,
        type: "BASE_MAP",
        listingId: creatingInListingId,
      })
    );
    dispatch(setCreatingInListingId(null));
  }

  function handleCloseSection() {
    dispatch(setShowCreateBaseMapSection(false));
  }

  // render

  if (!show) return null;

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1000,
      }}
    >
      {isCreatingInListing ? (
        <SectionCreateBaseMapFullscreen
          listing={creatingListing}
          showClose
          onClose={handleCloseCreatingInListing}
          onCreated={handleCreatedInListing}
        />
      ) : (
        <SectionCreateBaseMapFullscreen
          showClose={baseMaps?.length > 0}
          onClose={handleCloseSection}
        />
      )}
    </Box>
  );
}
