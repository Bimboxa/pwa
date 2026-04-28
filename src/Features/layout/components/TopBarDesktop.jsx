import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";
import {
  setIsCalibrating,
  setShowCalibration,
  setCalibrationTargets,
  setHiddenVersionIds,
} from "Features/baseMapEditor/baseMapEditorSlice";
import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import computeCalibrationTransform, {
  DEFAULT_RED,
  DEFAULT_GREEN,
} from "Features/mapEditor/utils/computeCalibrationTransform";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { setListingViewerSelectedListingId } from "Features/listingViewer/listingViewerSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useMainBaseMapListing from "Features/baseMaps/hooks/useMainBaseMapListing";

import { Box, Button, Divider } from "@mui/material";
import { ArrowBack, ChevronRight } from "@mui/icons-material";

import BoxFlexH from "Features/layout/components/BoxFlexH";
//import SelectorProject from "Features/projectSelector/components/SelectorProject";
import ButtonSelectorProject from "Features/projects/components/ButtonSelectorProject";
import ButtonSelectorScope from "Features/scopes/components/ButtonSelectorScope";

import IconButtonDialogSync from "Features/remoteScopeConfigurations/components/IconButtonDialogSync";
import IconButtonShareScope from "Features/scopes/components/IconButtonShareScope";
import ButtonToggleThreedViewer from "Features/viewers/components/ButtonToggleThreedViewer";
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
  const isCalibrating = useSelector((s) => s.baseMapEditor.isCalibrating);
  const versionCompareId = useSelector(
    (s) => s.baseMapEditor.versionCompareId
  );
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );
  const baseMap = useMainBaseMap();
  const mainBaseMapListing = useMainBaseMapListing();

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

  const isPortfolioViewer = viewerKey === "PORTFOLIO";

  // handlers

  function handleReturnToDrawing() {
    dispatch(setSelectedViewerKey("MAP"));
    dispatch(setViewerReturnContext(null));
  }

  function handleCancelCalibration() {
    dispatch(setIsCalibrating(false));
    dispatch(setShowCalibration(false));
  }

  async function handleConfirmCalibration() {
    if (!baseMap || !versionCompareId) return;

    const activeVersion = baseMap.getActiveVersion();
    if (!activeVersion) return;

    const activeTargets = calibrationTargetsByVersionId[activeVersion.id] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };
    const refTargets = calibrationTargetsByVersionId[versionCompareId] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };

    const refSize = baseMap.getImageSize();
    if (!refSize) return;

    const activeTransform = activeVersion.transform || {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
    };

    const newTransform = computeCalibrationTransform({
      activeTargets,
      refTargets,
      refSize,
      activeTransform,
    });

    if (!newTransform) return;

    await db.baseMapVersions.update(activeVersion.id, {
      transform: newTransform,
    });

    // Move active targets to reference positions after calibration
    dispatch(
      setCalibrationTargets({
        versionId: activeVersion.id,
        red: { x: refTargets.red.x, y: refTargets.red.y },
        green: { x: refTargets.green.x, y: refTargets.green.y },
      })
    );

    dispatch(setIsCalibrating(false));
    dispatch(setShowCalibration(false));
  }

  function handleGoToBaseMapsDetail() {
    // Hide all non-active versions so only the active one is visible
    const versions = baseMap?.versions || [];
    const activeVersion = baseMap?.getActiveVersion?.();
    if (activeVersion) {
      const nonActiveIds = versions
        .filter((v) => v.id !== activeVersion.id)
        .map((v) => v.id);
      dispatch(setHiddenVersionIds(nonActiveIds));
    }
    dispatch(
      setSelectedItem({
        id: baseMap.id,
        type: "BASE_MAP",
        listingId: mainBaseMapListing?.id,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
    dispatch(setSelectedViewerKey("BASE_MAPS"));
    dispatch(setViewerReturnContext({ fromViewer: "MAP" }));
  }

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
        alignItems: "center",
        bgcolor: "white",
        zIndex: 1000,
        pr: 2,
        pl: 0.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Left section - breadcrumbs */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1 }}>
        <TopBarBreadcrumbs />
        {scopesEnabled && <ButtonSelectorScope />}
        {returnLabel && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 3 }}>
            <Divider orientation="vertical" sx={{ height: 24 }} />
            <Button
              size="small"
              color="secondary"
              startIcon={<ArrowBack />}
              onClick={handleReturnToViewer}
            >
              {returnLabel}
            </Button>
          </Box>
        )}
      </Box>

      {/* Center section - baseMap selectors or portfolio return */}
      {(viewerKey === "MAP" || viewerKey === "BASE_MAPS") && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <BaseMapSelectorInMapEditorV2 />
          <BaseMapVersionSelectorInTopBar />
          {viewerKey === "MAP" && (
            <Button
              size="small"
              endIcon={<ChevronRight />}
              onClick={handleGoToBaseMapsDetail}
              sx={{ color: "grey.400" }}
            >
              Voir le détail
            </Button>
          )}
        </Box>
      )}
      {isPortfolioViewer && (
        <Button
          size="small"
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={handleReturnToDrawing}
          sx={{
            bgcolor: "warning.main",
            color: "warning.contrastText",
            "&:hover": { bgcolor: "warning.dark" },
          }}
        >
          Revenir au module Dessin
        </Button>
      )}
      {viewerKey === "BASE_MAPS" && returnViewer === "MAP" && !isCalibrating && (
        <Button
          size="small"
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={handleReturnToDrawing}
          sx={{
            ml: 2,
            bgcolor: "warning.main",
            color: "warning.contrastText",
            "&:hover": { bgcolor: "warning.dark" },
          }}
        >
          Revenir au Dessin
        </Button>
      )}
      {viewerKey === "BASE_MAPS" && isCalibrating && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleCancelCalibration}
          >
            Annuler
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleConfirmCalibration}
            sx={{
              bgcolor: "warning.main",
              color: "warning.contrastText",
              "&:hover": { bgcolor: "warning.dark" },
            }}
          >
            Calibrer
          </Button>
        </Box>
      )}

      {/* Right section - actions */}
      <Box sx={{ display: "flex", alignItems: "center", flex: 1, justifyContent: "flex-end", gap: 1 }}>
        <ButtonToggleThreedViewer />
        <IconButtonDialogSync />
        <IconButtonShareScope />
      </Box>
    </Box>
  );
}
