import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import computeHeaderPosition, {
  ROW_HEIGHT,
  LOGO_COL_WIDTH,
} from "../utils/computeHeaderPosition";

import theme from "Styles/theme";

// --- Inner component: a single cell with label + value ---

const FONT_FAMILY = "sans-serif";

function CartoucheCell({ x, y, width, height, label, value }) {
  return (
    <foreignObject
      x={x}
      y={y}
      width={width}
      height={height}
      style={{ overflow: "visible", pointerEvents: "none" }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          padding: "3px 6px",
          height: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "1px",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontSize: "7px",
            color: "#888",
            fontWeight: "bold",
            lineHeight: 1.2,
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: "#333",
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {value || "\u00A0"}
        </span>
      </div>
    </foreignObject>
  );
}

// --- Main component ---

export default function PortfolioHeaderSvg({
  page,
  pageDims,
  pageIndex,
  totalPages,
}) {
  const dispatch = useDispatch();

  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const { value: scope } = useSelectedScope();
  const { value: project } = useSelectedProject();
  const selectedItems = useSelector(selectSelectedItems);

  // helpers

  const config = portfolio?.headerConfig || {};
  const rect = computeHeaderPosition(pageDims);

  const isSelected = selectedItems.some(
    (i) => i.id === portfolio?.id && i.type === "PORTFOLIO_HEADER"
  );

  const showLogo = config.showLogo !== false && config.logo;
  const logoW = showLogo ? LOGO_COL_WIDTH : 0;
  const contentW = rect.width - logoW;
  const mainW = Math.round(contentW * 0.6);
  const metaW = contentW - mainW;

  // column x positions
  const x0 = rect.x;
  const x1 = x0 + logoW;
  const x2 = x1 + mainW;
  const x3 = x0 + rect.width;

  // row y positions
  const y0 = rect.y;
  const y1 = y0 + ROW_HEIGHT;
  const y2 = y0 + 2 * ROW_HEIGHT;
  const y3 = y0 + rect.height;

  // field data
  const pageNum = `p.${(pageIndex ?? 0) + 1}/${totalPages ?? 1}`;
  const chantierValue = scope?.name || project?.name || "";
  const portfolioValue = portfolio?.title || "";
  const pageValue = page?.title ? `${page.title}  ${pageNum}` : pageNum;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    if (!portfolio) return;
    dispatch(
      setSelectedItem({ id: portfolio.id, type: "PORTFOLIO_HEADER" })
    );
  }

  // render

  if (!portfolio) return null;

  return (
    <g onClick={handleClick} style={{ cursor: "pointer" }}>
      {/* Background */}
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
            x1={x1}
            y1={y0}
            x2={x1}
            y2={y3}
            stroke="#333"
            strokeWidth={0.5}
          />
          <image
            href={config.logo}
            x={x0 + 4}
            y={y0 + 4}
            width={logoW - 8}
            height={rect.height - 8}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      )}

      {/* Vertical separator: main | meta */}
      <line
        x1={x2}
        y1={y0}
        x2={x2}
        y2={y3}
        stroke="#333"
        strokeWidth={0.5}
      />

      {/* Horizontal row separators */}
      <line
        x1={x1}
        y1={y1}
        x2={x3}
        y2={y1}
        stroke="#333"
        strokeWidth={0.5}
      />
      <line
        x1={x1}
        y1={y2}
        x2={x3}
        y2={y2}
        stroke="#333"
        strokeWidth={0.5}
      />

      {/* Main section cells */}
      <CartoucheCell
        x={x1}
        y={y0}
        width={mainW}
        height={ROW_HEIGHT}
        label={config.labelChantier || "Chantier"}
        value={chantierValue}
      />
      <CartoucheCell
        x={x1}
        y={y1}
        width={mainW}
        height={ROW_HEIGHT}
        label={config.labelPortfolio || "Portfolio"}
        value={portfolioValue}
      />
      <CartoucheCell
        x={x1}
        y={y2}
        width={mainW}
        height={ROW_HEIGHT}
        label={config.labelPage || "Page"}
        value={pageValue}
      />

      {/* Meta section cells */}
      <CartoucheCell
        x={x2}
        y={y0}
        width={metaW}
        height={ROW_HEIGHT}
        label={config.labelRefInterne || "Ref. Interne"}
        value={config.refInterne || ""}
      />
      <CartoucheCell
        x={x2}
        y={y1}
        width={metaW}
        height={ROW_HEIGHT}
        label={config.labelAuteur || "Auteur"}
        value={config.author || ""}
      />
      <CartoucheCell
        x={x2}
        y={y2}
        width={metaW}
        height={ROW_HEIGHT}
        label={config.labelDate || "Date"}
        value={config.date || ""}
      />

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
