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
import MainZonesViewer from "Features/zonings/components/MainZonesViewer";
import ViewerAdmin from "Features/adminEditor/components/ViewerAdmin";
import MainListingViewer from "Features/listingViewer/components/MainListingViewer";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";
import PanelMeshesViewer from "Features/threedMesh/components/PanelMeshesViewer";
import PanelPovList from "Features/pov/components/PanelPovList";
import ButtonSavePov from "Features/pov/components/ButtonSavePov";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import { Box } from "@mui/material";

export default function SectionViewer() {
  // data
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);
  const disable3D = useSelector((s) => s.appConfig.disable3D);

  // helpers

  // viewerKey is the selected MODULE; multi-editor modules (Dessin, POV)
  // resolve to the editor they display (the disable3D fallback to MAP is
  // centralized in the selector).
  const isPov = viewerKey === "POINT_OF_VIEW";
  const effectiveKey = useSelector(selectEffectiveViewerKey);

  const showMap = effectiveKey === "MAP";
  // THREED and MESHES share the single MainThreedEditor instance (WebGL
  // context kept alive); MESHES adds the mailles drawer next to it.
  const showThreed = isThreedFamilyViewerKey(effectiveKey) && !disable3D;
  const showMeshes = viewerKey === "MESHES" && !disable3D;
  const showLeaflet = viewerKey === "LEAFLET";
  const showTable = viewerKey === "TABLE";
  const showPortfolio = viewerKey === "PORTFOLIO";
  const showBaseMaps = viewerKey === "BASE_MAPS";
  const showZones = viewerKey === "ZONES";
  const showListing = viewerKey === "LISTING";
  const showAdmin = viewerKey === "ADMIN";

  return (
    // overflow hidden clips the sliding POV drawer at the viewer's left edge
    // so it slides under the black viewers band; stretch makes the docked POV
    // drawer fill the full height (same flex-row archi as MainBaseMapViewer).
    <BoxCenter
      sx={{ position: "relative", overflow: "hidden", alignItems: "stretch" }}
    >
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

      {showZones && <PanelShowable show={showZones} sx={{ position: "absolute", zIndex: 0 }}>
        <MainZonesViewer />
      </PanelShowable>}

      {showListing && <PanelShowable show={showListing} sx={{ position: "absolute", zIndex: 0 }}>
        <MainListingViewer />
      </PanelShowable>}

      {showAdmin && <PanelShowable show={showAdmin} sx={{ position: "absolute", zIndex: 0 }}>
        <ViewerAdmin />
      </PanelShowable>}

      {/* POV: floating save button at the bottom of the displayed editor
          (replaces the 3D bottom toolbar, hidden under POV). */}
      {isPov && <ButtonSavePov />}
      </Box>
    </BoxCenter>
  );
}
