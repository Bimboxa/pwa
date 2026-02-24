import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";

import computeHeaderPosition from "../utils/computeHeaderPosition";

import theme from "Styles/theme";

const LOGO_COL_WIDTH = 80;
const ROW_1_HEIGHT = 28;
const ROW_2_HEIGHT = 28;
const ROW_3_HEIGHT = 24;
const FONT_FAMILY = "sans-serif";
const TEXT_PADDING = 6;

export default function PortfolioHeaderSvg({ page, pageDims }) {
  const dispatch = useDispatch();

  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const selectedItems = useSelector(selectSelectedItems);

  // helpers

  const config = portfolio?.headerConfig || {};
  const position = config.position || "bottom-right";
  const rect = computeHeaderPosition(pageDims, position);

  const isSelected = selectedItems.some(
    (i) => i.id === portfolio?.id && i.type === "PORTFOLIO"
  );

  const showLogo = config.logo && config.showLogo !== false;
  const logoWidth = showLogo ? LOGO_COL_WIDTH : 0;
  const textColWidth = rect.width - logoWidth;

  const title = config.showTitle !== false ? portfolio?.title || "" : "";
  const pageTitle =
    config.showPageTitle !== false ? page?.title || "" : "";
  const author = config.showAuthor !== false ? config.author || "" : "";
  const date = config.showDate !== false ? config.date || "" : "";

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    if (!portfolio) return;
    dispatch(setSelectedItem({ id: portfolio.id, type: "PORTFOLIO" }));
  }

  // render

  if (!portfolio) return null;

  return (
    <g onClick={handleClick} style={{ cursor: "pointer" }}>
      {/* Outer border */}
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill="white"
        stroke="#333"
        strokeWidth={1}
      />

      {/* Logo area */}
      {showLogo && (
        <>
          <line
            x1={rect.x + logoWidth}
            y1={rect.y}
            x2={rect.x + logoWidth}
            y2={rect.y + ROW_1_HEIGHT + ROW_2_HEIGHT}
            stroke="#333"
            strokeWidth={0.5}
          />
          <image
            href={config.logo}
            x={rect.x + 4}
            y={rect.y + 4}
            width={logoWidth - 8}
            height={ROW_1_HEIGHT + ROW_2_HEIGHT - 8}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      )}

      {/* Row 1: portfolio title */}
      <line
        x1={rect.x + logoWidth}
        y1={rect.y + ROW_1_HEIGHT}
        x2={rect.x + rect.width}
        y2={rect.y + ROW_1_HEIGHT}
        stroke="#333"
        strokeWidth={0.5}
      />
      <text
        x={rect.x + logoWidth + TEXT_PADDING}
        y={rect.y + ROW_1_HEIGHT / 2}
        dominantBaseline="central"
        fontSize={11}
        fontWeight="bold"
        fontFamily={FONT_FAMILY}
        fill="#333"
      >
        {title}
      </text>

      {/* Row 2: page title */}
      <line
        x1={rect.x}
        y1={rect.y + ROW_1_HEIGHT + ROW_2_HEIGHT}
        x2={rect.x + rect.width}
        y2={rect.y + ROW_1_HEIGHT + ROW_2_HEIGHT}
        stroke="#333"
        strokeWidth={0.5}
      />
      <text
        x={rect.x + logoWidth + TEXT_PADDING}
        y={rect.y + ROW_1_HEIGHT + ROW_2_HEIGHT / 2}
        dominantBaseline="central"
        fontSize={10}
        fontFamily={FONT_FAMILY}
        fill="#333"
      >
        {pageTitle}
      </text>

      {/* Row 3: author | date */}
      <line
        x1={rect.x + rect.width / 2}
        y1={rect.y + ROW_1_HEIGHT + ROW_2_HEIGHT}
        x2={rect.x + rect.width / 2}
        y2={rect.y + rect.height}
        stroke="#333"
        strokeWidth={0.5}
      />
      <text
        x={rect.x + TEXT_PADDING}
        y={rect.y + ROW_1_HEIGHT + ROW_2_HEIGHT + ROW_3_HEIGHT / 2}
        dominantBaseline="central"
        fontSize={9}
        fontFamily={FONT_FAMILY}
        fill="#555"
      >
        {author}
      </text>
      <text
        x={rect.x + rect.width / 2 + TEXT_PADDING}
        y={rect.y + ROW_1_HEIGHT + ROW_2_HEIGHT + ROW_3_HEIGHT / 2}
        dominantBaseline="central"
        fontSize={9}
        fontFamily={FONT_FAMILY}
        fill="#555"
      >
        {date}
      </text>

      {/* Selection border */}
      {isSelected && (
        <rect
          x={rect.x - 1}
          y={rect.y - 1}
          width={rect.width + 2}
          height={rect.height + 2}
          fill="none"
          stroke={theme.palette.viewers.portfolio}
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
    </g>
  );
}
