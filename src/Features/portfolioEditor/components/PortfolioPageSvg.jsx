import { useState, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import {
  setFramingContainerId,
  setFramingMode,
} from "Features/portfolioBaseMapContainers/portfolioBaseMapContainersSlice";
import {
  setSourceContainer,
  clearSourceContainer,
} from "Features/baseMapCreator/baseMapCreatorSlice";

import { Box, IconButton, Tooltip } from "@mui/material";
import {
  Draw,
  Crop,
  CropFree,
  RestartAlt,
  Lock,
  LockOpen,
} from "@mui/icons-material";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import usePortfolioBaseMapContainers from "Features/portfolioBaseMapContainers/hooks/usePortfolioBaseMapContainers";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import useCreatePortfolioBaseMapContainer from "Features/portfolioBaseMapContainers/hooks/useCreatePortfolioBaseMapContainer";

import BaseMapContainerSvg from "./BaseMapContainerSvg";
import PovContainerSvg from "./PovContainerSvg";
import EmptyContainerPlaceholder from "./EmptyContainerPlaceholder";
import LegendBlockSvg from "./LegendBlockSvg";
import BaseMapSelectorPopover from "./BaseMapSelectorPopover";
import PortfolioHeaderSvg from "./PortfolioHeaderSvg";
import PortfolioPageFrameSvg from "./PortfolioPageFrameSvg";
import PortfolioTitleBarSvg from "./PortfolioTitleBarSvg";
import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import getPageDimensions from "../utils/getPageDimensions";
import getPageLayout from "../utils/getPageLayout";
import computePageFrame from "../utils/computePageFrame";
import fitContainerToBaseMap from "../utils/fitContainerToBaseMap";
import getBaseMapContainerDefaultLayout from "../utils/getBaseMapContainerDefaultLayout";
import resolveContainerScaleLocked from "../utils/resolveContainerScaleLocked";
import getPortfolioPageScaleLabel, {
  getLargestBaseMapContainer,
} from "../utils/getPortfolioPageScaleLabel";
import getPovImageInfo from "Features/pov/utils/getPovImageInfo";

import db from "App/db/db";

export default function PortfolioPageSvg({
  page,
  pageIndex,
  totalPages,
  zoom,
}) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const { value: containers } = usePortfolioBaseMapContainers({
    filterByPageId: page.id,
  });
  const { value: portfolio } = useDisplayedPortfolio();
  const titleBlockManifest = useTitleBlockManifest(portfolio);
  const pageFrame = usePortfolioPageFrame();
  const framingContainerId = useSelector(
    (s) => s.portfolioBaseMapContainers.framingContainerId
  );
  const framingMode = useSelector(
    (s) => s.portfolioBaseMapContainers.framingMode
  );

  // state

  const [popoverAnchorEl, setPopoverAnchorEl] = useState(null);
  const [popoverContainerId, setPopoverContainerId] = useState(null);
  const [creatingContainerId, setCreatingContainerId] = useState(null);
  const emptyPlaceholderRef = useRef(null);
  const createContainer = useCreatePortfolioBaseMapContainer();

  // strings

  const lockedTooltipS =
    "Échelle verrouillée : déplacer et recadrer uniquement";
  const unlockedTooltipS = "Échelle libre : étirer et zoomer possibles";
  const frameDisabledTooltipS =
    "Échelle verrouillée - déverrouillez le cadenas pour zoomer";

  // helpers

  const isSelected = selectedItems.some(
    (i) => i.id === page.id && i.type === "PORTFOLIO_PAGE"
  );
  const dims = getPageDimensions(page.format, page.orientation);
  const footerHeight = portfolio?.metadata?.footerHeight || 0;
  const layout = getPageLayout(
    page.format,
    page.orientation,
    footerHeight,
    titleBlockManifest.height,
    pageFrame
  );
  const contentArea = layout.contentArea;

  const updateEntity = useUpdateEntity();
  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );

  // override empty container positions to align below header
  const displayContainers = useMemo(() => {
    return containers?.map((c) => {
      if (!c.baseMapId && !c.povId) {
        return {
          ...c,
          x: contentArea.x,
          y: contentArea.y,
          width: contentArea.width,
          height: contentArea.height,
        };
      }
      return c;
    });
  }, [
    containers,
    contentArea.x,
    contentArea.y,
    contentArea.width,
    contentArea.height,
  ]);

  const selectedContainer = displayContainers?.find((c) =>
    selectedItems.some((i) => i.id === c.id && i.type === "BASE_MAP_CONTAINER")
  );
  // Framing (« Cadrer » / « Croper ») is sticky: it follows the framing
  // container id, not the selection, so a click elsewhere (another page, the
  // background) never drops the crop frame — only « Terminer » / Escape do.
  const framingContainer = displayContainers?.find(
    (c) => c.id === framingContainerId && c.baseMapId
  );
  const isFraming = Boolean(framingContainer);
  const isCropping = isFraming && framingMode === "CROP";
  const activeContainer = framingContainer ?? selectedContainer;
  // default toolbar: a selected base map container while no framing is
  // active anywhere
  const showEditButton = selectedContainer?.baseMapId && !framingContainerId;
  const activeBaseMap = useBaseMap({ id: activeContainer?.baseMapId });
  // Scale lock (« cadenas d'échelle »): move + crop only, never stretch / zoom.
  const scaleLocked = resolveContainerScaleLocked(
    activeContainer,
    activeBaseMap?.getPrintZone?.()
  );

  // printed scale of the page (title block « Echelle » cell): from the
  // largest base map container when it prints its scaled print zone at the
  // zone's ratio (full page or cropped, never zoomed / stretched)
  const largestContainer = useMemo(
    () => getLargestBaseMapContainer(containers),
    [containers]
  );
  const largestBaseMap = useBaseMap({ id: largestContainer?.baseMapId });
  const scaleLabel = getPortfolioPageScaleLabel({
    page,
    container: largestContainer,
    printZone: largestBaseMap?.getPrintZone?.(),
  });

  // handlers

  function handleFrame() {
    if (isFraming) {
      // « Terminer »: leave the mode and give the container back its
      // selection (a click elsewhere may have cleared it meanwhile)
      dispatch(setFramingContainerId(null));
      dispatch(
        setSelectedItem({
          id: framingContainer.id,
          type: "BASE_MAP_CONTAINER",
          portfolioPageId: framingContainer.portfolioPageId,
        })
      );
      return;
    }
    if (scaleLocked) return;
    dispatch(setFramingMode("FRAME"));
    dispatch(setFramingContainerId(selectedContainer.id));
  }

  function handleCrop() {
    dispatch(setFramingMode("CROP"));
    dispatch(setFramingContainerId(selectedContainer.id));
  }

  // « Reset »: puts the print zone back in the page (full page + zone as
  // viewBox, page format from the zone) — the base map assignment layout.
  async function handleResetLayout() {
    if (!activeBaseMap || !activeContainer) return;
    const layout = getBaseMapContainerDefaultLayout({
      printZone: activeBaseMap.getPrintZone?.(),
      imageSize: activeBaseMap.getImageSize(),
      contentArea,
    });
    if (!layout) return;
    const { pageFormat } = layout;
    if (
      pageFormat &&
      (page.format !== pageFormat.format ||
        page.orientation !== pageFormat.orientation)
    ) {
      await updateEntity(page.id, pageFormat, { listing: portfolio });
    }
    await db.portfolioBaseMapContainers.update(activeContainer.id, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      viewBox: layout.viewBox,
    });
    dispatch(setFramingContainerId(null));
  }

  async function handleToggleScaleLock() {
    if (!activeContainer) return;
    const nextLocked = !scaleLocked;
    // locking while « Cadrer » is active leaves the zoomable mode
    if (nextLocked && isFraming && framingMode === "FRAME") {
      dispatch(setFramingContainerId(null));
    }
    await db.portfolioBaseMapContainers.update(activeContainer.id, {
      scaleLocked: nextLocked,
    });
  }

  function handleClick(e) {
    e.stopPropagation();
    if (framingContainerId) return;
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: page.listingId,
      })
    );
  }

  function handlePlaceholderClick({ anchorEl, containerId }) {
    if (creatingContainerId) return;
    setPopoverAnchorEl(anchorEl);
    setPopoverContainerId(containerId);
  }

  function handleEmptyPagePlaceholderClick(e) {
    e.stopPropagation();
    setPopoverAnchorEl(emptyPlaceholderRef.current);
    setPopoverContainerId(null);
  }

  function handlePopoverClose() {
    setPopoverAnchorEl(null);
    setPopoverContainerId(null);
  }

  async function handleSelectBaseMap(baseMap) {
    let containerId = popoverContainerId;

    // create a container if the page is empty
    if (!containerId) {
      const created = await createContainer({
        portfolioPageId: page.id,
        scopeId: page.scopeId,
        projectId: page.projectId,
        x: contentArea.x,
        y: contentArea.y,
        width: contentArea.width,
        height: contentArea.height,
      });
      containerId = created.id;
    }

    const layout = getBaseMapContainerDefaultLayout({
      printZone: baseMap.getPrintZone?.(),
      imageSize: baseMap.getImageSize(),
      contentArea,
    });
    const pageFormat = layout?.pageFormat;
    if (
      pageFormat &&
      (page.format !== pageFormat.format ||
        page.orientation !== pageFormat.orientation)
    ) {
      await updateEntity(page.id, pageFormat, { listing: portfolio });
    }
    await db.portfolioBaseMapContainers.update(containerId, {
      baseMapId: baseMap.id,
      ...(layout && {
        x: layout.x,
        y: layout.y,
        width: layout.width,
        height: layout.height,
        viewBox: layout.viewBox,
      }),
    });

    // rename page title on first baseMap assignment
    if (page.title === "Nouvelle page" || page.title.startsWith("Page ")) {
      await updateEntity(
        page.id,
        { title: baseMap.name },
        { listing: portfolio }
      );
    }

    handlePopoverClose();
  }

  async function handleSelectPov(pov) {
    let containerId = popoverContainerId;

    // create a container if the page is empty
    if (!containerId) {
      const created = await createContainer({
        portfolioPageId: page.id,
        scopeId: page.scopeId,
        projectId: page.projectId,
        x: contentArea.x,
        y: contentArea.y,
        width: contentArea.width,
        height: contentArea.height,
      });
      containerId = created.id;
    }

    const imageInfo = await getPovImageInfo(pov);

    if (imageInfo) {
      const imageSize = { width: imageInfo.width, height: imageInfo.height };
      const fitted = fitContainerToBaseMap(imageSize, contentArea);
      await db.portfolioBaseMapContainers.update(containerId, {
        povId: pov.id,
        baseMapId: null,
        x: fitted.x,
        y: fitted.y,
        width: fitted.width,
        height: fitted.height,
        viewBox: {
          x: 0,
          y: 0,
          width: imageSize.width,
          height: imageSize.height,
        },
      });
    } else {
      await db.portfolioBaseMapContainers.update(containerId, {
        povId: pov.id,
        baseMapId: null,
      });
    }

    // rename page title on first pov assignment
    if (page.title === "Nouvelle page" || page.title.startsWith("Page ")) {
      const title = pov.description || "Point de vue";
      await updateEntity(page.id, { title }, { listing: portfolio });
    }

    handlePopoverClose();
  }

  async function handleCreateBaseMap() {
    let containerId = popoverContainerId;

    // create a container if the page is empty
    if (!containerId) {
      const created = await createContainer({
        portfolioPageId: page.id,
        scopeId: page.scopeId,
        projectId: page.projectId,
        x: contentArea.x,
        y: contentArea.y,
        width: contentArea.width,
        height: contentArea.height,
      });
      containerId = created.id;
    }

    handlePopoverClose();
    setCreatingContainerId(containerId);
    dispatch(
      setSourceContainer({
        containerId,
        contentArea,
        pageId: page.id,
        portfolioId: page.listingId,
      })
    );
  }

  async function handleBaseMapCreated(entity) {
    if (!creatingContainerId || !entity?.id) return;

    const record = await db.baseMaps.get(entity.id);
    const imageSize = record?.image?.imageSize;

    if (imageSize) {
      const fitted = fitContainerToBaseMap(imageSize, contentArea);
      await db.portfolioBaseMapContainers.update(creatingContainerId, {
        baseMapId: entity.id,
        x: fitted.x,
        y: fitted.y,
        width: fitted.width,
        height: fitted.height,
        viewBox: {
          x: 0,
          y: 0,
          width: imageSize.width,
          height: imageSize.height,
        },
      });
    } else {
      await db.portfolioBaseMapContainers.update(creatingContainerId, {
        baseMapId: entity.id,
      });
    }

    // rename page title
    if (page.title === "Nouvelle page" || page.title.startsWith("Page ")) {
      const name = entity.name || record?.name || "Base map";
      await updateEntity(page.id, { title: name }, { listing: portfolio });
    }

    setCreatingContainerId(null);
    dispatch(clearSourceContainer());
  }

  function handleCreateClose() {
    setCreatingContainerId(null);
    dispatch(clearSourceContainer());
  }

  function handleEditInMap() {
    if (!selectedContainer?.baseMapId) return;
    dispatch(
      setViewerReturnContext({
        fromViewer: "PORTFOLIO",
        portfolioId: displayedPortfolioId,
        pageId: page.id,
        containerId: selectedContainer.id,
      })
    );
    dispatch(setSelectedMainBaseMapId(selectedContainer.baseMapId));
    dispatch(setSelectedViewerKey("MAP"));
  }

  // render

  return (
    <Box
      onClick={handleClick}
      sx={{
        cursor: "pointer",
        position: "relative",
        boxShadow: isSelected
          ? (theme) => `0 0 0 3px ${theme.palette.viewers.portfolio}`
          : "0 2px 8px rgba(0,0,0,0.15)",
        borderRadius: "2px",
      }}
    >
      <svg
        data-portfolio-page-id={page.id}
        width={dims.width}
        height={dims.height}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        style={{ display: "block", background: "white" }}
      >
        {displayContainers?.length === 0 && (
          <svg
            ref={emptyPlaceholderRef}
            x={contentArea.x}
            y={contentArea.y}
            width={contentArea.width}
            height={contentArea.height}
          >
            <EmptyContainerPlaceholder
              width={contentArea.width}
              height={contentArea.height}
              onClick={handleEmptyPagePlaceholderClick}
            />
          </svg>
        )}
        {displayContainers?.map((container) =>
          container.povId ? (
            <PovContainerSvg
              key={container.id}
              container={container}
              zoom={zoom}
            />
          ) : (
            <BaseMapContainerSvg
              key={container.id}
              container={container}
              zoom={zoom}
              onPlaceholderClick={handlePlaceholderClick}
            />
          )
        )}
        {displayContainers
          ?.filter((c) => c.baseMapId)
          .map((container) => (
            <LegendBlockSvg
              key={`legend-${container.id}`}
              container={container}
              zoom={zoom}
            />
          ))}
        <PortfolioPageFrameSvg frame={computePageFrame(dims, pageFrame)} />
        <PortfolioHeaderSvg
          page={page}
          layout={layout}
          pageIndex={pageIndex}
          totalPages={totalPages}
          scaleLabel={scaleLabel}
        />
        <PortfolioTitleBarSvg
          page={page}
          portfolio={portfolio}
          titleBar={layout.titleBar}
          pageDims={dims}
          pageFrame={pageFrame}
          zoom={zoom}
        />
      </svg>

      <BaseMapSelectorPopover
        anchorEl={popoverAnchorEl}
        open={Boolean(popoverAnchorEl)}
        onClose={handlePopoverClose}
        onSelectBaseMap={handleSelectBaseMap}
        onCreateBaseMap={handleCreateBaseMap}
        onSelectPov={handleSelectPov}
      />

      {showEditButton && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            left: selectedContainer.x,
            top: selectedContainer.y + selectedContainer.height + 8,
            // above the next page's white sheet
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <ButtonGeneric
            label="Repérer"
            variant="outlined"
            size="small"
            startIcon={<Draw />}
            onClick={handleEditInMap}
            sx={{ bgcolor: "white" }}
          />
          <ButtonGeneric
            label="Croper"
            variant="outlined"
            size="small"
            startIcon={<Crop />}
            onClick={handleCrop}
            sx={{ bgcolor: "white" }}
          />
          <Tooltip title={scaleLocked ? frameDisabledTooltipS : ""}>
            <span>
              <ButtonGeneric
                label="Cadrer"
                variant="outlined"
                size="small"
                startIcon={<CropFree />}
                onClick={handleFrame}
                disabled={scaleLocked}
                sx={{ bgcolor: "white" }}
              />
            </span>
          </Tooltip>
          <ButtonGeneric
            label="Reset"
            variant="outlined"
            size="small"
            startIcon={<RestartAlt />}
            onClick={handleResetLayout}
            sx={{ bgcolor: "white" }}
          />
          <Tooltip title={scaleLocked ? lockedTooltipS : unlockedTooltipS}>
            <IconButton
              size="small"
              onClick={handleToggleScaleLock}
              sx={{
                bgcolor: "white",
                border: "1px solid",
                borderColor: "divider",
                "&:hover": { bgcolor: "white" },
              }}
            >
              {scaleLocked ? (
                <Lock sx={{ fontSize: 18 }} color="primary" />
              ) : (
                <LockOpen sx={{ fontSize: 18, color: "text.disabled" }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {isFraming && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            left: framingContainer.x,
            top: framingContainer.y + framingContainer.height + 8,
            // above the next page's white sheet
            zIndex: 2,
            display: "flex",
            gap: 0.5,
          }}
        >
          <ButtonGeneric
            label="Reset"
            variant="outlined"
            size="small"
            startIcon={<RestartAlt />}
            onClick={handleResetLayout}
            sx={{ bgcolor: "white" }}
          />
          <ButtonGeneric
            label="Terminer"
            variant="contained"
            size="small"
            startIcon={isCropping ? <Crop /> : <CropFree />}
            onClick={handleFrame}
          />
        </Box>
      )}

      {creatingContainerId && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            left: contentArea.x,
            top: contentArea.y,
            width: contentArea.width,
            height: contentArea.height,
            bgcolor: "white",
            border: "2px dashed",
            borderColor: "divider",
            borderRadius: 1,
            overflow: "hidden",
            zIndex: 1,
          }}
        >
          <SectionCreateBaseMapFullscreen
            onClose={handleCreateClose}
            showClose
            onCreated={handleBaseMapCreated}
          />
        </Box>
      )}
    </Box>
  );
}
