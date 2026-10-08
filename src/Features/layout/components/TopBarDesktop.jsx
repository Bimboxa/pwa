import { useDispatch, useSelector } from "react-redux";

import { setViewerReturnContext } from "Features/viewers/viewersSlice";
import {
  setIsCalibrating,
  setShowCalibration,
  setCalibrationTargets,
} from "Features/baseMapEditor/baseMapEditorSlice";
import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import computeCalibrationTransform, {
  DEFAULT_RED,
  DEFAULT_GREEN,
} from "Features/mapEditor/utils/computeCalibrationTransform";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import {
  setSelectedListingId,
  setScopeModuleShowAllListings,
} from "Features/listings/listingsSlice";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import useSwitchViewer from "Features/viewers/hooks/useSwitchViewer";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeModuleLabel from "Features/listingViewer/hooks/useScopeModuleLabel";

import { Box, Button, Divider } from "@mui/material";

import { TOP_BAR_Z_INDEX } from "../constants/editorFloatingPanelsHost";
import { ArrowBack } from "@mui/icons-material";

import BoxFlexH from "Features/layout/components/BoxFlexH";
//import SelectorProject from "Features/projectSelector/components/SelectorProject";
import ButtonSelectorProject from "Features/projects/components/ButtonSelectorProject";
import ButtonSelectorScope from "Features/scopes/components/ButtonSelectorScope";

import ButtonSaveScope from "Features/remoteScopeConfigurations/components/ButtonSaveScope";
import ButtonHistoryScope from "Features/remoteScopeConfigurations/components/ButtonHistoryScope";
import IconButtonShareScope from "Features/scopes/components/IconButtonShareScope";
//import ButtonSelectorScopeInTopBar from "Features/scopes/components/ButtonSelectorScopeInTopBar";
import AuthButtons from "Features/auth/components/AuthButtons";
import TopBarProjectAndScope from "./TopBarProjectAndScope";

import TopBarBreadcrumbs from "./TopBarBreadcrumbs";
import useSelectedEntityModel from "Features/listings/hooks/useSelectedEntityModel";
import ToolbarDrawingTools from "Features/mapEditor/components/ToolbarDrawingTools";
import BlockVersionInTopBar from "Features/versions/components/BlockVersionInTopBar";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import BaseMapSelectorInMapEditorV2 from "Features/baseMaps/components/BaseMapSelectorInMapEditorV2";
import BaseMapVersionSelectorInTopBar from "Features/baseMaps/components/BaseMapVersionSelectorInTopBar";
import FieldBaseMapZInTopBar from "Features/baseMaps/components/FieldBaseMapZInTopBar";
import { isBusinessObjectsModuleKey } from "Features/businessObjects/utils/businessObjectModuleKeys";

export default function TopBarDesktop() {
  const dispatch = useDispatch();
  const switchViewer = useSwitchViewer();

  // data

  const height = useSelector((s) => s.layout.topBarHeight);
  const appConfig = useAppConfig();
  const { value: listing } = useSelectedListing();
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const isCalibrating = useSelector((s) => s.baseMapEditor.isCalibrating);
  const versionCompareId = useSelector((s) => s.baseMapEditor.versionCompareId);
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );
  const baseMap = useMainBaseMap();

  // helper - em

  const em = listing?.entityModel;

  // helpers

  const scopesEnabled = appConfig?.features?.scopes?.enabled;
  const returnViewer = viewerReturnContext?.fromViewer;
  const scopeModuleLabel = useScopeModuleLabel();

  // The return button is the only thing that clears a SCOPE / PORTFOLIO
  // return context (handleReturnToViewer) — every fromViewer written by the
  // recap / portfolio openers must have a label here.
  const returnLabelByViewer = {
    PORTFOLIO: "Portfolio",
    SCOPE: scopeModuleLabel,
  };
  const returnLabel = returnLabelByViewer[returnViewer];

  const isPortfolioViewer = viewerKey === "PORTFOLIO";

  // The top bar is module-driven: the Dessin module keeps its baseMap
  // selector (the baseMap drawn annotations get linked to) whichever editor
  // (2D/3D) it displays; the 3D recap and Maillage modules have none (pure
  // viewers / per-scope mailles). POV keeps the 2D selector when it displays
  // the map editor, and — like the 3D module — nothing when it displays the 3D
  // editor: the base maps are picked from the "Fonds de plan" list of the
  // popper / left panel there.
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const isPovViewer = viewerKey === "POINT_OF_VIEW";
  const isPovMap = isPovViewer && effectiveViewerKey === "MAP";
  // Ouvrages module: same rule as POV — the 2D selector shows while the
  // module displays the map editor, the 3D editor keeps its canvas chips.
  const isBusinessObjectsMap =
    isBusinessObjectsModuleKey(viewerKey) && effectiveViewerKey === "MAP";
  // While the create-baseMap overlay is open, the baseMap-related controls
  // (selector, versions, Z) are meaningless: hide the whole center section.
  const isCreatingBaseMap = useSelector(
    (s) => s.mapEditor.showCreateBaseMapSection
  );

  // handlers

  function handleReturnToDrawing() {
    switchViewer("MAP");
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

  function handleReturnToViewer() {
    if (returnViewer === "PORTFOLIO" && viewerReturnContext?.portfolioId) {
      dispatch(setDisplayedPortfolioId(viewerReturnContext.portfolioId));
    }
    // The listing viewer reads s.listings.selectedListingId (MainListingViewer,
    // SelectorListingForViewer), not the listingViewer slice. A plan opened
    // from a listing goes back to that listing; one opened from the
    // all-listings recap goes back to it.
    if (returnViewer === "SCOPE") {
      const listingId = viewerReturnContext?.listingId;
      if (listingId) dispatch(setSelectedListingId(listingId));
      dispatch(setScopeModuleShowAllListings(!listingId));
    }
    switchViewer(returnViewer);
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
        // Under the editors' floating panels (draggable over the top bar).
        zIndex: TOP_BAR_Z_INDEX,
        pr: 2,
        pl: 0.5,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Left section - breadcrumbs */}
      <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            gap: 0.5,
          }}
        >
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
      </Box>

      {/* Center section - baseMap selectors or portfolio return */}
      {!isCreatingBaseMap &&
        (viewerKey === "MAP" ||
          viewerKey === "BASE_MAPS" ||
          isPovMap ||
          isBusinessObjectsMap) && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <BaseMapSelectorInMapEditorV2
              // The BaseMaps module edits the image itself: no eye there.
              showImageToggle={viewerKey !== "BASE_MAPS"}
            />
            <BaseMapVersionSelectorInTopBar />
            <FieldBaseMapZInTopBar />
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
      {viewerKey === "BASE_MAPS" &&
        returnViewer === "MAP" &&
        !isCalibrating && (
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flex: 1,
          justifyContent: "flex-end",
          gap: 1,
        }}
      >
        {/* 2D/3D editor toggle moved to the bottom-right overlay of both
            editors (UILayerDesktop / MainThreedEditor). */}
        {/* Scope-level actions (save/sync, history, share): available in
            every module, whichever editor it displays. */}
        {!viewerMode && (
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              gap: 1,
            }}
          >
            <ButtonSaveScope />
            <ButtonHistoryScope />
            <IconButtonShareScope />
          </Box>
        )}
      </Box>
    </Box>
  );
}
