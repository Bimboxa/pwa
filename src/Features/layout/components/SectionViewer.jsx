import { useSelector } from "react-redux";

import BoxCenter from "./BoxCenter";
import PanelShowable from "./PanelShowable";
import MainMapEditorV2 from "Features/mapEditor/components/MainMapEditorV2";
import MainMapEditorV3 from "Features/mapEditor/components/MainMapEditorV3";
import MainThreedEditor from "Features/threedEditor/components/MainThreedEditor";
import MainLeafletEditor from "Features/leafletEditor/components/MainLeafletEditor";
import MainGoogleMapEditor from "Features/gmap/components/MainGoogleMapEditor";
import TableViewer from "Features/tables/components/ViewerTable";
import MainPortfolioEditor from "Features/portfolioEditor/components/MainPortfolioEditor";
import MainBaseMapViewer from "Features/baseMapEditor/components/MainBaseMapViewer";
import ViewerAdmin from "Features/adminEditor/components/ViewerAdmin";
import MainListingViewer from "Features/listingViewer/components/MainListingViewer";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";
import PanelMeshesViewer from "Features/threedMesh/components/PanelMeshesViewer";
import PanelPovList from "Features/pov/components/PanelPovList";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import { Box } from "@mui/material";

export default function SectionViewer() {
  // data
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const povViewerMode = useSelector((s) => s.pov.viewerMode);

  // helpers

  // POINT_OF_VIEW is a meta viewer: it shows the MAP or THREED editor (per
  // pov.viewerMode) with the capture framing forced on, plus its own drawer.
  const isPov = viewerKey === "POINT_OF_VIEW";
  const effectiveKey = isPov
    ? povViewerMode === "THREED"
      ? "THREED"
      : "MAP"
    : viewerKey;

  const showMap = effectiveKey === "MAP";
  // THREED and MESHES share the single MainThreedEditor instance (WebGL
  // context kept alive); MESHES adds the mailles drawer next to it.
  const showThreed = isThreedFamilyViewerKey(effectiveKey) && !disable3D;
  const showMeshes = viewerKey === "MESHES" && !disable3D;
  const showLeaflet = viewerKey === "LEAFLET";
  const showTable = viewerKey === "TABLE";
  const showPortfolio = viewerKey === "PORTFOLIO";
  const showBaseMaps = viewerKey === "BASE_MAPS";
  const showListing = viewerKey === "LISTING";
  const showAdmin = viewerKey === "ADMIN";

  return (
    <BoxCenter sx={{ position: "relative" }}>
      {/* POV drawer: in-flow sibling of the editors area (docked mode shrinks
          the displayed 2D/3D editor, drawer mode slides over it on hover). */}
      {isPov && (
        <LeftDrawerPanel width={300} viewerKey="POINT_OF_VIEW">
          <PanelPovList />
        </LeftDrawerPanel>
      )}

      <Box sx={{ flex: 1, minWidth: 0, height: 1, position: "relative" }}>
      <PanelShowable show={showMap} sx={{ position: "absolute", zIndex: 0 }}>
        {legacy ? <MainMapEditorV2 /> : <MainMapEditorV3 />}
      </PanelShowable>
      <PanelShowable
        show={showThreed}
        sx={{ position: "absolute", zIndex: 0 }}
      >
        <Box
          sx={{
            width: 1,
            height: 1,
            display: "flex",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {showMeshes && (
            <LeftDrawerPanel width={280} viewerKey="MESHES">
              <PanelMeshesViewer />
            </LeftDrawerPanel>
          )}
          <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
            <MainThreedEditor />
          </Box>
        </Box>
      </PanelShowable>

      <PanelShowable
        show={showLeaflet}
        sx={{ position: "absolute", zIndex: 0 }}
      >
        {/* <MainLeafletEditor /> */}
        {/* <MainGoogleMapEditor /> */}
      </PanelShowable>

      {showTable && <PanelShowable show={showTable} sx={{ position: "absolute", zIndex: 0 }}>
        <TableViewer />
      </PanelShowable>}

      {showPortfolio && <PanelShowable show={showPortfolio} sx={{ position: "absolute", zIndex: 0 }}>
        <MainPortfolioEditor />
      </PanelShowable>}

      {showBaseMaps && <PanelShowable show={showBaseMaps} sx={{ position: "absolute", zIndex: 0 }}>
        <MainBaseMapViewer />
      </PanelShowable>}

      {showListing && <PanelShowable show={showListing} sx={{ position: "absolute", zIndex: 0 }}>
        <MainListingViewer />
      </PanelShowable>}

      {showAdmin && <PanelShowable show={showAdmin} sx={{ position: "absolute", zIndex: 0 }}>
        <ViewerAdmin />
      </PanelShowable>}
      </Box>
    </BoxCenter>
  );
}
