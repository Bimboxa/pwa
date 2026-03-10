import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setListingViewerSelectedListingId } from "Features/listingViewer/listingViewerSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Button, Divider } from "@mui/material";
import { ArrowBack } from "@mui/icons-material";

import BoxFlexH from "Features/layout/components/BoxFlexH";
//import SelectorProject from "Features/projectSelector/components/SelectorProject";
import ButtonSelectorProject from "Features/projects/components/ButtonSelectorProject";
import ButtonSelectorScope from "Features/scopes/components/ButtonSelectorScope";

import IconButtonDialogSync from "Features/remoteScopeConfigurations/components/IconButtonDialogSync";
import IconButtonShareScope from "Features/scopes/components/IconButtonShareScope";
//import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import AuthButtons from "Features/auth/components/AuthButtons";
import TopBarProjectAndScope from "./TopBarProjectAndScope";
import ToggleOpenLeftPanel from "Features/leftPanel/components/ToggleOpenLeftPanel";

import TopBarBreadcrumbs from "./TopBarBreadcrumbs";
import useSelectedEntityModel from "Features/listings/hooks/useSelectedEntityModel";
import ToolbarDrawingTools from "Features/mapEditor/components/ToolbarDrawingTools";
import BlockVersionInTopBar from "Features/versions/components/BlockVersionInTopBar";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import BaseMapSelectorInMapEditorV2 from "Features/baseMaps/components/BaseMapSelectorInMapEditorV2";
import BaseMapVersionSelectorInTopBar from "Features/baseMaps/components/BaseMapVersionSelectorInTopBar";

export default function TopBarDesktop() {
  const dispatch = useDispatch();

  // data

  const height = useSelector((s) => s.layout.topBarHeight);
  const appConfig = useAppConfig();
  const { value: listing } = useSelectedListing();
  const viewerReturnContext = useSelector(
    (s) => s.viewers.viewerReturnContext
  );
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // helper - em

  const em = listing?.entityModel;

  // helpers

  const scopesEnabled = appConfig?.features?.scopes?.enabled;
  const returnViewer = viewerReturnContext?.fromViewer;

  const returnLabelByViewer = {
    PORTFOLIO: "Portfolio",
    LISTING: "Objets",
  };
  const returnLabel = returnLabelByViewer[returnViewer];

  // handlers

  function handleReturnToViewer() {
    if (returnViewer === "PORTFOLIO" && viewerReturnContext?.portfolioId) {
      dispatch(setDisplayedPortfolioId(viewerReturnContext.portfolioId));
    }
    if (returnViewer === "LISTING" && viewerReturnContext?.listingId) {
      dispatch(
        setListingViewerSelectedListingId(viewerReturnContext.listingId)
      );
    }
    dispatch(setSelectedViewerKey(returnViewer));
    dispatch(setViewerReturnContext(null));
  }

  return (
    <Box
      sx={{
        width: 1,
        height,
        minHeight: height,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        bgcolor: "white",
        zIndex: 1000,
        pr: 2,
        pl: 0.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* <ButtonSelectorScopeInTopBar /> */}
      {/* <BoxFlexH>
        <ButtonSelectorProject />
        <Box sx={{ px: 1 }}>
          <Divider orientation="vertical" flexItem sx={{ height: 24 }} />
        </Box>
        <ButtonSelectorScope />
      </BoxFlexH> */}

      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>

        <TopBarBreadcrumbs />
        {/* <BlockVersionInTopBar /> */}
        {/* <TopBarProjectAndScope /> */}
        {scopesEnabled && <ButtonSelectorScope />}



        <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 3 }}>
          <Divider orientation="vertical" sx={{ height: 24 }} />
          {returnLabel && (
            <Button
              size="small"
              color="secondary"
              startIcon={<ArrowBack />}
              onClick={handleReturnToViewer}
            >
              {returnLabel}
            </Button>
          )}
          {(viewerKey === "MAP" || viewerKey === "BASE_MAPS") && (
            <>
              <BaseMapSelectorInMapEditorV2 />
              <BaseMapVersionSelectorInTopBar />
            </>
          )}

        </Box>


      </Box>



      {/* <AuthButtons /> */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {/* <Box sx={{ mr: 3 }}>
          <ToolbarDrawingTools />
        </Box> */}

        <IconButtonDialogSync />
        <IconButtonShareScope />
      </Box>
    </Box>
  );
}
