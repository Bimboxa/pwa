import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import LegendTransformOverlay from "./LegendTransformOverlay";

import useFolioDetailRef from "../hooks/useFolioDetailRef";
import resolveDetailRefFormat, {
  toPersistedDetailRefFormat,
  getDetailRefText,
} from "../utils/resolveDetailRefFormat";

const FONT_FAMILY = "sans-serif";

const JUSTIFY_BY_ALIGN = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

// Detail reference element on FOLIO_PAGE pages ("Détail 3", top-right by
// default): click to select, drag / resize via LegendTransformOverlay.
// Selection type PORTFOLIO_DETAIL_REF routes to its dedicated panel.
export default function PortfolioDetailRefSvg({
  page,
  portfolio,
  pageDims,
  pageFrame,
  zoom = 1,
}) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const updateEntity = useUpdateEntity();
  const refNumber = useFolioDetailRef(page);

  // refs

  const wrapperRef = useRef(null);

  // helpers

  const resolved = resolveDetailRefFormat(page, { pageDims, pageFrame });
  const rect = resolved.rect;

  const isSelected = selectedItems.some(
    (i) => i.id === page.id && i.type === "PORTFOLIO_DETAIL_REF"
  );

  const text = getDetailRefText(resolved, refNumber);

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_DETAIL_REF",
        portfolioId: page.listingId,
      })
    );
  }

  async function handleCommitTransform({ x, y, width }) {
    await updateEntity(
      page.id,
      {
        detailRefFormat: toPersistedDetailRefFormat(resolved, { x, y, width }),
      },
      { listing: portfolio }
    );
  }

  // render

  if (!resolved.show) return null;

  return (
    <g
      data-portfolio-detail-ref
      onClick={handleClick}
      style={{ cursor: "pointer" }}
    >
      <g ref={wrapperRef}>
        <foreignObject
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          style={{ overflow: "visible" }}
        >
          <div
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: `${resolved.fontSize}px`,
              fontWeight: 700,
              color: resolved.color,
              display: "flex",
              alignItems: "center",
              justifyContent: JUSTIFY_BY_ALIGN[resolved.align] || "flex-end",
              height: "100%",
              padding: "0 12px",
              boxSizing: "border-box",
              whiteSpace: "nowrap",
            }}
          >
            {text || "\u00A0"}
          </div>
        </foreignObject>
      </g>

      {isSelected && (
        <LegendTransformOverlay
          rect={rect}
          zoom={zoom}
          onCommit={handleCommitTransform}
          legendRef={wrapperRef}
        />
      )}
    </g>
  );
}
