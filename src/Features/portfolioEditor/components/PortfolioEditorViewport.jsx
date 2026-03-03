import { useRef, useState, useCallback, useEffect, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";
import { selectSelectedItem } from "Features/selection/selectionSlice";

import { Box, IconButton, Tooltip } from "@mui/material";
import { FitScreen } from "@mui/icons-material";

import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";
import useCreatePortfolioPage from "Features/portfolioPages/hooks/useCreatePortfolioPage";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import getPageDimensions from "../utils/getPageDimensions";

import PortfolioPageSvg from "./PortfolioPageSvg";
import SectionPortfolioPageArticles from "Features/articles/components/SectionPortfolioPageArticles";
import ButtonAddPage from "./ButtonAddPage";

export default function PortfolioEditorViewport() {
  const dispatch = useDispatch();

  // data

  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: portfolio } = useDisplayedPortfolio();
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: displayedPortfolioId,
  });
  const createPage = useCreatePortfolioPage();
  const annotations = useAnnotationsV2({
    filterBySelectedScope: true,
    withQties: true,
    withListingName: true,
  });

  const selectedItem = useSelector(selectSelectedItem);

  // helpers

  const maxPageWidth = useMemo(() => {
    if (!pages?.length) return 0;
    return Math.max(
      ...pages.map((p) => getPageDimensions(p.format, p.orientation).width)
    );
  }, [pages]);

  // state

  const [zoom, setZoom] = useState(0.8);
  const containerRef = useRef(null);

  // effects

  useEffect(() => {
    if (selectedItem?.type !== "PORTFOLIO_PAGE") return;
    const el = containerRef.current?.querySelector(
      `[data-portfolio-page-id="${selectedItem.id}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedItem?.id, selectedItem?.type]);

  // handlers

  const handleWheel = useCallback(
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.02 : 0.02;
        setZoom((z) => Math.max(0.2, Math.min(3, z + delta)));
      }
    },
    []
  );

  function handleBackgroundClick(e) {
    if (e.target === e.currentTarget || e.target === containerRef.current) {
      dispatch(clearSelection());
    }
  }

  async function handleAddPage() {
    if (!portfolio) return;
    const lastPage = pages?.[pages.length - 1];
    await createPage({
      listing: portfolio,
      projectId,
      title: `Page ${(pages?.length || 0) + 1}`,
      afterSortIndex: lastPage?.sortIndex ?? null,
    });
  }

  function handleFitToWidth() {
    if (!maxPageWidth || !containerRef.current) return;
    const padding = 18 * 2;
    const availableWidth = containerRef.current.clientWidth - padding;
    const newZoom = Math.max(0.2, Math.min(3, availableWidth / maxPageWidth));
    setZoom(newZoom);
  }

  // render

  if (!displayedPortfolioId) {
    return (
      <Box sx={{ width: 1, height: 1, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      </Box>
    );
  }

  return (
    <Box sx={{ width: 1, height: 1, position: "relative" }}>
      <Box
        ref={containerRef}
        onWheel={handleWheel}
        onClick={handleBackgroundClick}
        sx={{
          width: 1,
          height: 1,
          overflow: "auto",
          bgcolor: "background.default",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        <Box
          sx={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 4,
            gap: 3,
            minHeight: "100%",
          }}
        >
          {pages?.map((page, index) => {
            const dims = getPageDimensions(page.format, page.orientation);
            return (
              <Box key={page.id} sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <PortfolioPageSvg
                  page={page}
                  pageIndex={index}
                  totalPages={pages.length}
                  zoom={zoom}
                />
                <Box sx={{ width: dims.width }}>
                  <SectionPortfolioPageArticles page={page} annotations={annotations} />
                </Box>
              </Box>
            );
          })}

          <ButtonAddPage onClick={handleAddPage} />
        </Box>
      </Box>

      <Tooltip title="Fit to width" placement="left">
        <IconButton
          onClick={handleFitToWidth}
          size="small"
          sx={{
            position: "absolute",
            bottom: 16,
            right: 16,
            bgcolor: "background.paper",
            boxShadow: 2,
            "&:hover": { bgcolor: "background.paper" },
          }}
        >
          <FitScreen fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
