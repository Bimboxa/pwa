import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import LegendTransformOverlay from "./LegendTransformOverlay";

import resolveTitleFormat, {
  toPersistedTitleFormat,
} from "../utils/resolveTitleFormat";
import getPortfolioPageTitleText from "../utils/getPortfolioPageTitleText";

const FONT_FAMILY = "sans-serif";

// Configurable page title (page.titleFormat): click to select, drag / resize
// via LegendTransformOverlay, double-click to edit the custom text inline.
// The PDF export hides the whole [data-portfolio-title-bar] group before
// rasterization and redraws it as vector content (useDownloadPortfolioPdf).
export default function PortfolioTitleBarSvg({
  page,
  portfolio,
  titleBar,
  pageDims,
  pageFrame,
  zoom = 1,
}) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const updateEntity = useUpdateEntity();

  // state

  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState("");
  const cancelledRef = useRef(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // helpers

  const resolved = resolveTitleFormat(page, { titleBar, pageDims, pageFrame });
  const rect = resolved.rect;

  const isSelected = selectedItems.some(
    (i) => i.id === page.id && i.type === "PORTFOLIO_TITLE"
  );

  const text = getPortfolioPageTitleText(resolved, {
    portfolioName: portfolio?.name,
    pageName: page?.title,
  });

  const prefixPart = resolved.prefixPortfolioName ? portfolio?.name : null;
  const suffixPart = resolved.suffixPageName ? page?.title : null;

  // effects

  useEffect(() => {
    if (!isSelected) setEditing(false);
  }, [isSelected]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_TITLE",
        portfolioId: page.listingId,
      })
    );
  }

  function handleDoubleClick(e) {
    e.stopPropagation();
    cancelledRef.current = false;
    setLocalText(resolved.customText);
    setEditing(true);
  }

  async function commitText(value) {
    setEditing(false);
    if (value === resolved.customText) return;
    await updateEntity(
      page.id,
      { titleFormat: toPersistedTitleFormat(resolved, { customText: value }) },
      { listing: portfolio }
    );
  }

  function handleInputBlur() {
    if (cancelledRef.current) return;
    commitText(localText);
  }

  function handleInputKeyDown(e) {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitText(localText);
    } else if (e.key === "Escape") {
      cancelledRef.current = true;
      setEditing(false);
    }
  }

  async function handleCommitTransform({ x, y, width }) {
    await updateEntity(
      page.id,
      { titleFormat: toPersistedTitleFormat(resolved, { x, y, width }) },
      { listing: portfolio }
    );
  }

  // render

  if (!resolved.show) return null;

  const textStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: `${resolved.fontSize}px`,
    fontWeight: 700,
    color: resolved.color,
    textDecoration: resolved.underline ? "underline" : "none",
    textUnderlineOffset: "3px",
  };

  return (
    <g
      data-portfolio-title-bar
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
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
              ...textStyle,
              display: "flex",
              alignItems: "center",
              height: "100%",
              paddingLeft: "12px",
              boxSizing: "border-box",
              whiteSpace: "nowrap",
            }}
          >
            {editing ? (
              <>
                {prefixPart && <span>{`${prefixPart} \u00B7 `}</span>}
                <input
                  ref={inputRef}
                  autoFocus
                  value={localText}
                  onChange={(e) => setLocalText(e.target.value)}
                  onBlur={handleInputBlur}
                  onKeyDown={handleInputKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  style={{
                    ...textStyle,
                    flex: 1,
                    minWidth: "40px",
                    border: "none",
                    outline: "1px dashed #999",
                    background: "transparent",
                    padding: 0,
                  }}
                />
                {suffixPart && <span>{` \u00B7 ${suffixPart}`}</span>}
              </>
            ) : (
              text || "\u00A0"
            )}
          </div>
        </foreignObject>
      </g>

      {isSelected && !editing && (
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
