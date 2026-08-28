import { useSelector } from "react-redux";

import BoxCenter from "./BoxCenter";
import BoxFlexVStretch from "./BoxFlexVStretch";
import PanelShowable from "./PanelShowable";
import MainMapEditorV2 from "Features/mapEditor/components/MainMapEditorV2";
import MainMapEditorV3 from "Features/mapEditor/components/MainMapEditorV3";
import MainThreedEditor from "Features/threedEditor/components/MainThreedEditor";
import MainLeafletEditor from "Features/leafletEditor/components/MainLeafletEditor";
import MainGoogleMapEditor from "Features/gmap/components/MainGoogleMapEditor";
import TableViewer from "Features/tables/components/ViewerTable";
import MainPortfolioEditor from "Features/portfolioEditor/components/MainPortfolioEditor";
import MainBaseMapViewer from "Features/baseMapEditor/components/MainBaseMapViewer";
import ZoningsTree from "Features/zonings/components/ZoningsTree";
import PanelBaseMaps from "Features/baseMapEditor/components/PanelBaseMaps";
import ViewerAdmin from "Features/adminEditor/components/ViewerAdmin";
import MainListingViewer from "Features/listingViewer/components/MainListingViewer";
import LeftDrawerPanel from "Features/leftPanel/components/LeftDrawerPanel";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import PanelMeshesViewer from "Features/threedMesh/components/PanelMeshesViewer";
import PanelDrawing from "Features/panelDrawing/components/PanelDrawing";
import PanelPhotos from "Features/photos/components/PanelPhotos";
import PanelViewerAnnotations from "Features/panelDrawing/components/PanelViewerAnnotations";
import PanelPovList from "Features/pov/components/PanelPovList";
import ButtonSavePov from "Features/pov/components/ButtonSavePov";
import ButtonCreatePovView from "Features/pov/components/ButtonCreatePovView";
import ButtonSaveCapture from "Features/mapEditor/components/ButtonSaveCapture";
import TopBaseMapChipsThreed from "Features/threedEditor/components/TopBaseMapChipsThreed";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import {
  selectCaptureFramingActive,
  selectEffectiveViewerKey,
  selectPovFramingActive,
} from "Features/viewers/utils/effectiveViewerKey";

import { Box } from "@mui/material";

export default function SectionViewer() {
  // data
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);
  const disable3D = useSelector((s) => s.appConfig.disable3D);

  // helpers

  // viewerKey is the selected MODULE; multi-editor modules (Dessin, POV,
  // Viewer, Zones) resolve to the editor they display (the disable3D fallback
  // to MAP is centralized in the selector).
  const isPov = viewerKey === "POINT_OF_VIEW";
  const effectiveKey = useSelector(selectEffectiveViewerKey);
  // The POV capture frame is armed on demand: without it, the module shows the
  // "Créer une vue" button instead of the save bar.
  const povFramingActive = useSelector(selectPovFramingActive);
  // Global Capture tool (hotkey V): its own save bar replaces the POV buttons
  // (mutually exclusive with the POV framing).
  const captureToolActive = useSelector((s) => s.mapEditor.captureToolActive);

  const showMap = effectiveKey === "MAP";
  // THREED and MESHES share the single MainThreedEditor instance (WebGL
  // context kept alive); MESHES adds the mailles drawer next to it.
  const showThreed = isThreedFamilyViewerKey(effectiveKey) && !disable3D;
  const showMeshes = viewerKey === "MESHES" && !disable3D;
  const showLeaflet = viewerKey === "LEAFLET";
  const showTable = viewerKey === "TABLE";
  const showPortfolio = viewerKey === "PORTFOLIO";
  // BASE_MAPS is multi-editor (T toggle): its 2D editor is its own
  // MainMapEditorV3 instance, its 3D editor the shared one. The module's
  // viewer stays MOUNTED (slid off-screen) while the 3D editor is displayed,
  // so the 3D->2D camera sync has a live 2D camera to pose.
  const isBaseMapsModule = viewerKey === "BASE_MAPS";
  const showBaseMaps = effectiveKey === "BASE_MAPS";
  // ZONES is multi-editor (T toggle) and owns no editor of its own: its 2D
  // editor IS the shared map editor above (so `Z` keeps the camera framing),
  // its 3D editor the shared 3D one. Only the zonings drawer is module-specific.
  const isZonesModule = viewerKey === "ZONES";
  const showListing = viewerKey === "LISTING";
  const showAdmin = viewerKey === "ADMIN";
  // Viewer module, 2D editor: the chips band replaces the topbar baseMap
  // selector (the 3D editor mounts its own instance in MainThreedEditor).
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const showViewerChipsIn2d =
    viewerKey === "THREED" && effectiveKey === "MAP" && !captureFramingActive;

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

      {/* Dessin module: interactive annotations drawer (listing selector,
          template rows with the split draw button, drawing tools) — took over
          the floating PopperMapListings (#310). Mounted for both editors of
          the module (the module key is unchanged when the 2D/3D toggle swaps
          the displayed editor). The outer guard is load-bearing — in docked
          mode LeftDrawerPanel renders its fixed-width box without checking
          viewerKey. */}
      {viewerKey === "MAP" && (
        <LeftDrawerPanel width={360} viewerKey="MAP">
          <PanelDrawing />
        </LeftDrawerPanel>
      )}

      {/* Photos module: albums drawer (album selector, upload drop zone,
          3-column thumbnail grid, photo detail subview). 2D-only module —
          its single editor is the shared "MAP" instance. The guard is
          load-bearing for the same reason as the Dessin panel. */}
      {viewerKey === "PHOTOS" && (
        <LeftDrawerPanel width={360} viewerKey="PHOTOS">
          <PanelPhotos />
        </LeftDrawerPanel>
      )}

      {/* Viewer module: read-only annotations drawer — every listing of the
          repérage as a collapsible section over its template rows (shares
          the detail subviews with the Dessin panel). */}
      {viewerKey === "THREED" && (
        <LeftDrawerPanel width={360} viewerKey="THREED">
          <PanelViewerAnnotations />
        </LeftDrawerPanel>
      )}

      {/* Zonings tree: same in-flow sibling pattern as the POV drawer, so it
          serves both the 2D and the 3D editor of the module. The isZonesModule
          guard is load-bearing — in docked mode LeftDrawerPanel renders its
          fixed-width box without checking viewerKey. */}
      {isZonesModule && (
        <LeftDrawerPanel width={300} viewerKey="ZONES">
          <BoxFlexVStretch sx={{ height: 1 }}>
            <LeftDrawerPanelHeader title="Zones" />
            <BoxFlexVStretch sx={{ overflow: "auto" }}>
              <ZoningsTree />
            </BoxFlexVStretch>
          </BoxFlexVStretch>
        </LeftDrawerPanel>
      )}

      {/* Base maps panel: in-flow sibling of the editors area so it serves
          both the 2D and the 3D editor of the module (same pattern as the
          Zones drawer; the guard is load-bearing for the same reason). The
          panel owns the tree / base map detail subview switching (#312). */}
      {isBaseMapsModule && (
        <LeftDrawerPanel width={360} viewerKey="BASE_MAPS">
          <PanelBaseMaps />
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

      {isBaseMapsModule && <PanelShowable show={showBaseMaps} sx={{ position: "absolute", zIndex: 0 }}>
        <MainBaseMapViewer />
      </PanelShowable>}

      {showListing && <PanelShowable show={showListing} sx={{ position: "absolute", zIndex: 0 }}>
        <MainListingViewer />
      </PanelShowable>}

      {showAdmin && <PanelShowable show={showAdmin} sx={{ position: "absolute", zIndex: 0 }}>
        <ViewerAdmin />
      </PanelShowable>}

      {showViewerChipsIn2d && <TopBaseMapChipsThreed />}

      {/* POV: floating button at the bottom of the displayed editor (replaces
          the 3D bottom toolbar, hidden under POV) — "Créer une vue" while
          browsing, the save bar once the frame is armed. */}
      {isPov &&
        (povFramingActive ? (
          <ButtonSavePov />
        ) : (
          !captureToolActive && <ButtonCreatePovView />
        ))}

      {/* Capture tool: save bar under the frame, in every module (fixed
          positioning — it measures the capture host itself) */}
      {captureToolActive && <ButtonSaveCapture />}
      </Box>
    </BoxCenter>
  );
}
