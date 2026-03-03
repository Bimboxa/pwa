import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedViewerKey,
  setPortfolioReturnContext,
} from "Features/viewers/viewersSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";

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

export default function TopBarDesktop() {
  const dispatch = useDispatch();

  // data

  const height = useSelector((s) => s.layout.topBarHeight);
  const appConfig = useAppConfig();
  const { value: listing } = useSelectedListing();
  const portfolioReturnContext = useSelector(
    (s) => s.viewers.portfolioReturnContext
  );
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);

  // helper - em

  const em = listing?.entityModel;

  // helpers

  const scopesEnabled = appConfig?.features?.scopes?.enabled;
  const showReturnToPortfolio = portfolioReturnContext?.fromPortfolio;

  // handlers

  function handleReturnToPortfolio() {
    if (portfolioReturnContext?.portfolioId) {
      dispatch(setDisplayedPortfolioId(portfolioReturnContext.portfolioId));
    }
    dispatch(setSelectedViewerKey("PORTFOLIO"));
    dispatch(setPortfolioReturnContext(null));
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
          {showReturnToPortfolio && (
            <Button
              size="small"
              //variant="contained"
              color="secondary"
              startIcon={<ArrowBack />}
              onClick={handleReturnToPortfolio}
            >
              Portfolio
            </Button>
          )}
          {/* BaseMapSelectorInMapEditorV2 moved to UILayerDesktop */}

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
