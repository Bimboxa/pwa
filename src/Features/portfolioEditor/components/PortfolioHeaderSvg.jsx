import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedItem,
  selectSelectedItems,
} from "Features/selection/selectionSlice";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import usePortfolioLogoUrl from "Features/portfolios/hooks/usePortfolioLogoUrl";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";

import { Edit } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import TitleBlockSvg from "Features/titleBlocks/components/TitleBlockSvg";
import TitleBlockLogoPlaceholder from "Features/titleBlocks/components/TitleBlockLogoPlaceholder";
import DialogEditPortfolioTitleBlock from "./DialogEditPortfolioTitleBlock";

import computeTitleBlockLayout from "Features/titleBlocks/utils/computeTitleBlockLayout";
import resolveTitleBlockFields from "Features/titleBlocks/utils/resolveTitleBlockFields";

import theme from "Styles/theme";
import db from "App/db/db";

// "Éditer" button size below / above the selected cartouche (SVG units)
const EDIT_BUTTON_WIDTH = 110;
const EDIT_BUTTON_HEIGHT = 36;
const EDIT_BUTTON_GAP = 8;

// Interactive container of the page title block (cartouche): selection,
// logo upload placeholder, "Éditer" button + double-click opening the
// enlarged edit dialog. Static drawing is delegated to TitleBlockSvg, fed by
// the shared computeTitleBlockLayout engine (same one used by the vector PDF
// export). The whole [data-portfolio-header] group is hidden at export, so
// the button never leaks into the rasterized page.
export default function PortfolioHeaderSvg({
  page,
  layout,
  pageIndex,
  totalPages,
}) {
  const dispatch = useDispatch();

  // strings

  const editS = "Éditer";

  // state

  const [dialogOpen, setDialogOpen] = useState(false);

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
    pageNum: totalPages
      ? `p. ${(pageIndex ?? 0) + 1} / ${totalPages}`
      : `p. ${(pageIndex ?? 0) + 1}`,
  };
  const layoutData = computeTitleBlockLayout(manifest, rect, {
    variant: layout.variant,
    values,
    bindings,
    labelOverrides: config,
  });
  const logoSlot = layoutData.imageSlots[0];

  // TOP_FULL: button below the frame; BOTTOM_RIGHT: the frame is glued to the
  // bottom margin, so the button sits above it.
  const editButtonY =
    layout.variant === "BOTTOM_RIGHT"
      ? rect.y - EDIT_BUTTON_GAP - EDIT_BUTTON_HEIGHT
      : rect.y + rect.height + EDIT_BUTTON_GAP;

  // handlers

  function handleClick(e) {
    e.stopPropagation();
    if (!portfolio) return;
    dispatch(setSelectedItem({ id: portfolio.id, type: "PORTFOLIO_HEADER" }));
  }

  function handleDoubleClick(e) {
    e.stopPropagation();
    if (!portfolio) return;
    if (!isSelected) {
      dispatch(setSelectedItem({ id: portfolio.id, type: "PORTFOLIO_HEADER" }));
    }
    setDialogOpen(true);
  }

  function handleEditClick(e) {
    e.stopPropagation();
    setDialogOpen(true);
  }

  function handleLogoFile(file) {
    if (!portfolio) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const updated = { ...config, logo: reader.result };
      await db.listings.update(portfolio.id, { metadata: updated });
    };
    reader.readAsDataURL(file);
  }

  // render

  if (!portfolio) return null;

  return (
    <g
      data-portfolio-header
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer" }}
    >
      <TitleBlockSvg
        layoutData={layoutData}
        style={manifest.style}
        logoUrl={resolvedLogoSrc}
      />

      {/* Logo upload placeholder */}
      {!resolvedLogoSrc && (
        <TitleBlockLogoPlaceholder
          slot={logoSlot}
          fontFamily={manifest.style?.fontFamily}
          onFile={handleLogoFile}
        />
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

      {/* "Éditer" button, same look as the container toolbar */}
      {isSelected && (
        <foreignObject
          x={rect.x}
          y={editButtonY}
          width={EDIT_BUTTON_WIDTH}
          height={EDIT_BUTTON_HEIGHT}
          style={{ overflow: "visible" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{ display: "flex" }}
          >
            <ButtonGeneric
              label={editS}
              variant="outlined"
              size="small"
              startIcon={<Edit />}
              onClick={handleEditClick}
              sx={{ bgcolor: "white" }}
            />
          </div>
        </foreignObject>
      )}

      <DialogEditPortfolioTitleBlock
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        page={page}
        layout={layout}
        pageIndex={pageIndex}
        totalPages={totalPages}
      />
    </g>
  );
}
