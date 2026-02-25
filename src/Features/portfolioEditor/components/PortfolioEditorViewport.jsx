import { useRef, useState, useCallback, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";
import { selectSelectedItem } from "Features/selection/selectionSlice";

import { Box } from "@mui/material";

import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";
import useCreatePortfolioPage from "Features/portfolioPages/hooks/useCreatePortfolioPage";

import PortfolioPageSvg from "./PortfolioPageSvg";
import ButtonAddPage from "./ButtonAddPage";

export default function PortfolioEditorViewport() {
  const dispatch = useDispatch();

  // data

  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: displayedPortfolioId,
  });
  const createPage = useCreatePortfolioPage();

  const selectedItem = useSelector(selectSelectedItem);

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
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
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
    if (!displayedPortfolioId) return;
    const lastPage = pages?.[pages.length - 1];
    await createPage({
      portfolioId: displayedPortfolioId,
      scopeId,
      projectId,
      title: `Page ${(pages?.length || 0) + 1}`,
      afterSortIndex: lastPage?.sortIndex ?? null,
    });
  }

  // render

  return (
    <Box
      ref={containerRef}
      onWheel={handleWheel}
      onClick={handleBackgroundClick}
      sx={{
        width: 1,
        height: 1,
        overflow: "auto",
        bgcolor: "#E0E0E0",
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
        {pages?.map((page, index) => (
          <PortfolioPageSvg
            key={page.id}
            page={page}
            pageIndex={index}
            totalPages={pages.length}
            zoom={zoom}
          />
        ))}

        <ButtonAddPage onClick={handleAddPage} />
      </Box>
    </Box>
  );
}
