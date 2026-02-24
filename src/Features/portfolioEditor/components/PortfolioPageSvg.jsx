import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import { Box } from "@mui/material";

import usePortfolioBaseMapContainers from "Features/portfolioBaseMapContainers/hooks/usePortfolioBaseMapContainers";

import BaseMapContainerSvg from "./BaseMapContainerSvg";
import PortfolioHeaderSvg from "./PortfolioHeaderSvg";
import getPageDimensions from "../utils/getPageDimensions";

export default function PortfolioPageSvg({ page }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const { value: containers } = usePortfolioBaseMapContainers({
    filterByPageId: page.id,
  });

  // helpers

  const isSelected = selectedItems.some(
    (i) => i.id === page.id && i.type === "PORTFOLIO_PAGE"
  );
  const dims = getPageDimensions(page.format, page.orientation);

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

  // render

  return (
    <Box
      onClick={handleClick}
      sx={{
        cursor: "pointer",
        boxShadow: isSelected
          ? (theme) => `0 0 0 3px ${theme.palette.viewers.portfolio}`
          : "0 2px 8px rgba(0,0,0,0.15)",
        borderRadius: "2px",
      }}
    >
      <svg
        width={dims.width}
        height={dims.height}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        style={{ display: "block", background: "white" }}
      >
        {containers?.map((container) => (
          <BaseMapContainerSvg key={container.id} container={container} />
        ))}
        <PortfolioHeaderSvg page={page} pageDims={dims} />
      </svg>
    </Box>
  );
}
