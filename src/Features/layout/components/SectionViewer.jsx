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

export default function SectionViewer() {
  // data
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const legacy = useSelector((s) => s.appConfig.enableMapEditorLegacy);

  // helpers

  const showMap = viewerKey === "MAP";
  const showThreed = viewerKey === "THREED";
  const showLeaflet = viewerKey === "LEAFLET";
  const showTable = viewerKey === "TABLE";
  const showPortfolio = viewerKey === "PORTFOLIO";
  const showBaseMaps = viewerKey === "BASE_MAPS";
  const showListing = viewerKey === "LISTING";
  const showAdmin = viewerKey === "ADMIN";

  return (
    <BoxCenter sx={{ position: "relative" }}>
      <PanelShowable show={showMap} sx={{ position: "absolute", zIndex: 0 }}>
        {legacy ? <MainMapEditorV2 /> : <MainMapEditorV3 />}
      </PanelShowable>
      <PanelShowable
        show={showThreed}
        sx={{ position: "absolute", zIndex: 0 }}
      >
        <MainThreedEditor />
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
    </BoxCenter>
  );
}
