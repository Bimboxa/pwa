import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Divider } from "@mui/material";

import BoxFlexH from "Features/layout/components/BoxFlexH";
//import SelectorProject from "Features/projectSelector/components/SelectorProject";
import ButtonSelectorProject from "Features/projects/components/ButtonSelectorProject";
import ButtonSelectorScope from "Features/scopes/components/ButtonSelectorScope";
import SelectorViewer from "Features/viewers/components/SelectorViewer";
//import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import AuthButtons from "Features/auth/components/AuthButtons";
import TopBarProjectAndScope from "./TopBarProjectAndScope";
import ToggleOpenLeftPanel from "Features/leftPanel/components/ToggleOpenLeftPanel";
import HorizontalMenuRightPanel from "Features/rightPanel/components/HorizontalMenuRightPanel";
import TopBarBreadcrumbs from "./TopBarBreadcrumbs";
import useSelectedEntityModel from "Features/listings/hooks/useSelectedEntityModel";
import ToolbarDrawingTools from "Features/mapEditor/components/ToolbarDrawingTools";
import BlockVersionInTopBar from "Features/versions/components/BlockVersionInTopBar";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function TopBarDesktop() {
  // data

  const height = useSelector((s) => s.layout.topBarHeight);
  const appConfig = useAppConfig();
  const { value: listing } = useSelectedListing();

  // helper - em

  const em = listing?.entityModel;

  // helpers

  const scopesEnabled = appConfig?.features?.scopes?.enabled;

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
        pr: 0.5,
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
      </Box>



      {/* <AuthButtons /> */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {/* <Box sx={{ mr: 3 }}>
          <ToolbarDrawingTools />
        </Box> */}
        {em?.type === "LOCATED_ENTITY" && <SelectorViewer />}
        <HorizontalMenuRightPanel />
      </Box>
    </Box>
  );
}
