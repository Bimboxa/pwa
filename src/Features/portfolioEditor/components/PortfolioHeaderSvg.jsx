import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import computeHeaderPosition, {
  ROW_HEIGHT,
  LOGO_COL_WIDTH,
} from "../utils/computeHeaderPosition";

import theme from "Styles/theme";
import db from "App/db/db";

// --- Inner components ---

const FONT_FAMILY = "sans-serif";
const PAGE_NUM_WIDTH = 50;

function LabelCell({ x, y, width, height, text }) {
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
          fontSize: "8px",
          color: "#888",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          height: "100%",
          paddingRight: "6px",
          boxSizing: "border-box",
        }}
      >
        {text}
      </div>
    </foreignObject>
  );
}

function ValueCell({ x, y, width, height, text, bold, center }) {
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
          fontSize: "10px",
          color: "#333",
          fontWeight: bold ? 700 : 400,
          display: "flex",
          alignItems: "center",
          justifyContent: center ? "center" : "flex-start",
          height: "100%",
          paddingLeft: center ? 0 : "8px",
          paddingRight: "4px",
          boxSizing: "border-box",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text || "\u00A0"}
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
  const logoInputRef = useRef(null);

  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const { value: project } = useSelectedProject();
  const selectedItems = useSelector(selectSelectedItems);

  // helpers

  const config = portfolio?.headerConfig || {};
  const rect = computeHeaderPosition(pageDims);

  const isSelected = selectedItems.some(
    (i) => i.id === portfolio?.id && i.type === "PORTFOLIO_HEADER"
  );

  // column layout (logo always visible)
  const logoW = LOGO_COL_WIDTH;
  const contentW = rect.width - logoW;
  const labelW = Math.round(contentW * 0.08);
  const metaLabelW = Math.round(contentW * 0.11);
  const metaValueW = Math.round(contentW * 0.15);
  const mainW = contentW - labelW - metaLabelW - metaValueW;

  // column x positions
  const xLogo = rect.x;
  const xLabel = xLogo + logoW;
  const xMain = xLabel + labelW;
  const xMetaLabel = xMain + mainW;
  const xMetaValue = xMetaLabel + metaLabelW;
  const xEnd = rect.x + rect.width;

  // row y positions
  const y0 = rect.y;
  const y1 = y0 + ROW_HEIGHT;
  const y2 = y0 + 2 * ROW_HEIGHT;
  const y3 = y0 + rect.height;

  // page number cell (row 3 only)
  const xPageNum = xMain + mainW - PAGE_NUM_WIDTH;

  // field data
  const pageNum = `p. ${(pageIndex ?? 0) + 1}`;
  const chantierValue = project?.name || "";
  const portfolioValue = portfolio?.title || "";
  const pageValue = page?.title || "";

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    if (!portfolio) return;
    dispatch(
      setSelectedItem({ id: portfolio.id, type: "PORTFOLIO_HEADER" })
    );
  }

  function handleLogoUpload(e) {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file || !portfolio) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const updated = { ...config, logo: reader.result };
      await db.portfolios.update(portfolio.id, { headerConfig: updated });
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
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

      {/* Vertical separators */}
      <line x1={xLabel} y1={y0} x2={xLabel} y2={y3} stroke="#333" strokeWidth={0.5} />
      <line x1={xMain} y1={y0} x2={xMain} y2={y3} stroke="#333" strokeWidth={0.5} />
      <line x1={xMetaLabel} y1={y0} x2={xMetaLabel} y2={y3} stroke="#333" strokeWidth={0.5} />
      <line x1={xMetaValue} y1={y0} x2={xMetaValue} y2={y3} stroke="#333" strokeWidth={0.5} />

      {/* Horizontal row separators */}
      <line x1={xLabel} y1={y1} x2={xEnd} y2={y1} stroke="#333" strokeWidth={0.5} />
      <line x1={xLabel} y1={y2} x2={xEnd} y2={y2} stroke="#333" strokeWidth={0.5} />

      {/* Row 3: page number vertical separator */}
      <line x1={xPageNum} y1={y2} x2={xPageNum} y2={y3} stroke="#333" strokeWidth={0.5} />

      {/* Logo or upload placeholder */}
      {config.logo ? (
        <image
          href={config.logo}
          x={xLogo + 4}
          y={y0 + 4}
          width={logoW - 8}
          height={rect.height - 8}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <foreignObject
          x={xLogo + 3}
          y={y0 + 3}
          width={logoW - 6}
          height={rect.height - 6}
        >
          <label
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              cursor: "pointer",
              border: "1.5px dashed #ccc",
              borderRadius: "3px",
              boxSizing: "border-box",
              background: "#fafafa",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="#bbb"
            >
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
            <span
              style={{
                fontSize: "7px",
                color: "#aaa",
                fontFamily: FONT_FAMILY,
                marginTop: "1px",
              }}
            >
              Logo
            </span>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleLogoUpload}
            />
          </label>
        </foreignObject>
      )}

      {/* Row 1: Chantier / Réf. Interne */}
      <LabelCell x={xLabel} y={y0} width={labelW} height={ROW_HEIGHT} text={config.labelChantier || "Chantier"} />
      <ValueCell x={xMain} y={y0} width={mainW} height={ROW_HEIGHT} text={chantierValue} bold />
      <LabelCell x={xMetaLabel} y={y0} width={metaLabelW} height={ROW_HEIGHT} text={config.labelRefInterne || "Réf. Interne"} />
      <ValueCell x={xMetaValue} y={y0} width={metaValueW} height={ROW_HEIGHT} text={config.refInterne || ""} />

      {/* Row 2: Portfolio / Auteur */}
      <LabelCell x={xLabel} y={y1} width={labelW} height={ROW_HEIGHT} text={config.labelPortfolio || "Portfolio"} />
      <ValueCell x={xMain} y={y1} width={mainW} height={ROW_HEIGHT} text={portfolioValue} bold />
      <LabelCell x={xMetaLabel} y={y1} width={metaLabelW} height={ROW_HEIGHT} text={config.labelAuteur || "Auteur"} />
      <ValueCell x={xMetaValue} y={y1} width={metaValueW} height={ROW_HEIGHT} text={config.author || ""} />

      {/* Row 3: Page + pageNum / Date */}
      <LabelCell x={xLabel} y={y2} width={labelW} height={ROW_HEIGHT} text={config.labelPage || "Page"} />
      <ValueCell x={xMain} y={y2} width={mainW - PAGE_NUM_WIDTH} height={ROW_HEIGHT} text={pageValue} />
      <ValueCell x={xPageNum} y={y2} width={PAGE_NUM_WIDTH} height={ROW_HEIGHT} text={pageNum} center bold />
      <LabelCell x={xMetaLabel} y={y2} width={metaLabelW} height={ROW_HEIGHT} text={config.labelDate || "Date"} />
      <ValueCell x={xMetaValue} y={y2} width={metaValueW} height={ROW_HEIGHT} text={config.date || ""} />

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
