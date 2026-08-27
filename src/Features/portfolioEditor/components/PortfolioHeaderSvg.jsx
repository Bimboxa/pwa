import { useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import usePortfolioLogoUrl from "Features/portfolios/hooks/usePortfolioLogoUrl";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";

import TitleBlockSvg from "Features/titleBlocks/components/TitleBlockSvg";

import computeTitleBlockLayout from "Features/titleBlocks/utils/computeTitleBlockLayout";
import resolveTitleBlockFields from "Features/titleBlocks/utils/resolveTitleBlockFields";

import theme from "Styles/theme";
import db from "App/db/db";

// Interactive container of the page title block (cartouche): selection,
// logo upload placeholder. Static drawing is delegated to TitleBlockSvg,
// fed by the shared computeTitleBlockLayout engine (same one used by the
// vector PDF export).
export default function PortfolioHeaderSvg({ page, layout, pageIndex }) {
  const dispatch = useDispatch();
  const logoInputRef = useRef(null);

  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const { value: project } = useSelectedProject();
  const selectedItems = useSelector(selectSelectedItems);
  const manifest = useTitleBlockManifest(portfolio);

  // helpers

  const config = portfolio?.metadata || {};
  const logoUrl = usePortfolioLogoUrl(config.logo);
  const resolvedLogoSrc =
    logoUrl || (typeof config.logo === "string" ? config.logo : null);
  const rect = layout.cartouche;

  const isSelected = selectedItems.some(
    (i) => i.id === portfolio?.id && i.type === "PORTFOLIO_HEADER"
  );

  const values = resolveTitleBlockFields(manifest, config);
  const bindings = {
    "project.name": project?.name || "",
    "portfolio.name": portfolio?.name || "",
    "page.title": page?.title || "",
    pageNum: `p. ${(pageIndex ?? 0) + 1}`,
  };
  const layoutData = computeTitleBlockLayout(manifest, rect, {
    variant: layout.variant,
    values,
    bindings,
    labelOverrides: config,
  });
  const logoSlot = layoutData.imageSlots[0];

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
      await db.listings.update(portfolio.id, { metadata: updated });
    };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  // render

  if (!portfolio) return null;

  return (
    <g data-portfolio-header onClick={handleClick} style={{ cursor: "pointer" }}>
      <TitleBlockSvg
        layoutData={layoutData}
        style={manifest.style}
        logoUrl={resolvedLogoSrc}
      />

      {/* Logo upload placeholder */}
      {!resolvedLogoSrc && logoSlot && (
        <foreignObject
          x={logoSlot.x - 1}
          y={logoSlot.y - 1}
          width={logoSlot.width + 2}
          height={logoSlot.height + 2}
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
                fontFamily: manifest.style?.fontFamily || "sans-serif",
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
