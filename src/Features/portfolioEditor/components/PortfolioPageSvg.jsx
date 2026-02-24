import { useState, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import {
  setSelectedViewerKey,
  setPortfolioReturnContext,
} from "Features/viewers/viewersSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import { Box } from "@mui/material";
import { Edit } from "@mui/icons-material";

import usePortfolioBaseMapContainers from "Features/portfolioBaseMapContainers/hooks/usePortfolioBaseMapContainers";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";

import BaseMapContainerSvg from "./BaseMapContainerSvg";
import BaseMapSelectorPopover from "./BaseMapSelectorPopover";
import PortfolioHeaderSvg from "./PortfolioHeaderSvg";
import SectionCreateBaseMapFullscreen from "Features/mapEditor/components/SectionCreateBaseMapFullscreen";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import getPageDimensions from "../utils/getPageDimensions";
import computeContentArea from "../utils/computeContentArea";
import fitContainerToBaseMap from "../utils/fitContainerToBaseMap";

import db from "App/db/db";

export default function PortfolioPageSvg({ page, pageIndex, totalPages, zoom }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const { value: containers } = usePortfolioBaseMapContainers({
    filterByPageId: page.id,
  });
  const { value: portfolio } = useDisplayedPortfolio();

  // state

  const [popoverAnchorEl, setPopoverAnchorEl] = useState(null);
  const [popoverContainerId, setPopoverContainerId] = useState(null);
  const [creatingContainerId, setCreatingContainerId] = useState(null);
  const closeTimerRef = useRef(null);

  // helpers

  const isSelected = selectedItems.some(
    (i) => i.id === page.id && i.type === "PORTFOLIO_PAGE"
  );
  const dims = getPageDimensions(page.format, page.orientation);
  const footerHeight = portfolio?.headerConfig?.footerHeight || 0;
  const contentArea = computeContentArea(dims, footerHeight);

  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );

  // override empty container positions to align below header
  const displayContainers = useMemo(() => {
    return containers?.map((c) => {
      if (!c.baseMapId) {
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
  }, [containers, contentArea.x, contentArea.y, contentArea.width, contentArea.height]);

  const selectedContainer = displayContainers?.find((c) =>
    selectedItems.some(
      (i) => i.id === c.id && i.type === "BASE_MAP_CONTAINER"
    )
  );
  const showEditButton = selectedContainer?.baseMapId;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: page.portfolioId,
      })
    );
  }

  function handlePlaceholderHover({ anchorEl, containerId }) {
    if (creatingContainerId) return;
    clearTimeout(closeTimerRef.current);
    setPopoverAnchorEl(anchorEl);
    setPopoverContainerId(containerId);
  }

  function handlePlaceholderLeave() {
    closeTimerRef.current = setTimeout(() => {
      setPopoverAnchorEl(null);
      setPopoverContainerId(null);
    }, 200);
  }

  function handlePopoverMouseEnter() {
    clearTimeout(closeTimerRef.current);
  }

  function handlePopoverClose() {
    clearTimeout(closeTimerRef.current);
    setPopoverAnchorEl(null);
    setPopoverContainerId(null);
  }

  async function handleSelectBaseMap(baseMap) {
    if (!popoverContainerId) return;

    const imageSize = baseMap.getImageSize();

    if (imageSize) {
      const fitted = fitContainerToBaseMap(imageSize, contentArea);
      const viewBox = {
        x: 0,
        y: 0,
        width: imageSize.width,
        height: imageSize.height,
      };
      await db.portfolioBaseMapContainers.update(popoverContainerId, {
        baseMapId: baseMap.id,
        x: fitted.x,
        y: fitted.y,
        width: fitted.width,
        height: fitted.height,
        viewBox,
      });
    } else {
      await db.portfolioBaseMapContainers.update(popoverContainerId, {
        baseMapId: baseMap.id,
      });
    }

    // rename page title on first baseMap assignment
    if (
      page.title === "Nouvelle page" ||
      page.title.startsWith("Page ")
    ) {
      await db.portfolioPages.update(page.id, { title: baseMap.name });
    }

    handlePopoverClose();
  }

  function handleCreateBaseMap() {
    const containerId = popoverContainerId;
    handlePopoverClose();
    setCreatingContainerId(containerId);
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
    if (
      page.title === "Nouvelle page" ||
      page.title.startsWith("Page ")
    ) {
      const name = entity.name || record?.name || "Base map";
      await db.portfolioPages.update(page.id, { title: name });
    }

    setCreatingContainerId(null);
  }

  function handleCreateClose() {
    setCreatingContainerId(null);
  }

  function handleEditInMap() {
    if (!selectedContainer?.baseMapId) return;
    dispatch(
      setPortfolioReturnContext({
        fromPortfolio: true,
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
        {displayContainers?.map((container) => (
          <BaseMapContainerSvg
            key={container.id}
            container={container}
            zoom={zoom}
            onPlaceholderHover={handlePlaceholderHover}
            onPlaceholderLeave={handlePlaceholderLeave}
          />
        ))}
        <PortfolioHeaderSvg
          page={page}
          pageDims={dims}
          pageIndex={pageIndex}
          totalPages={totalPages}
        />
      </svg>

      <BaseMapSelectorPopover
        anchorEl={popoverAnchorEl}
        open={Boolean(popoverAnchorEl)}
        onClose={handlePopoverClose}
        onSelectBaseMap={handleSelectBaseMap}
        onCreateBaseMap={handleCreateBaseMap}
        onMouseEnter={handlePopoverMouseEnter}
      />

      {showEditButton && (
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            left: selectedContainer.x,
            top: selectedContainer.y + selectedContainer.height + 8,
          }}
        >
          <ButtonGeneric
            label="Modifier le repérage"
            variant="outlined"
            size="small"
            startIcon={<Edit />}
            onClick={handleEditInMap}
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
