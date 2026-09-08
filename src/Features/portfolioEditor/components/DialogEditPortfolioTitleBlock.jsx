import { useEffect, useState } from "react";

import { Box, Typography } from "@mui/material";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import usePortfolioLogoUrl from "Features/portfolios/hooks/usePortfolioLogoUrl";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";
import TitleBlockEditableSvg from "Features/titleBlocks/components/TitleBlockEditableSvg";

import computeTitleBlockLayout from "Features/titleBlocks/utils/computeTitleBlockLayout";
import resolveTitleBlockFields from "Features/titleBlocks/utils/resolveTitleBlockFields";

import db from "App/db/db";

// Edit the page cartouche "in place", enlarged: every editable cell is an
// input, changes are held in a local draft and written in one pass on save.
// The layout is computed with the same variant / width as the page it was
// opened from so column widths match what the user sees. Writes target the
// same records as PanelPortfolioHeaderProperties (listing name + metadata)
// and PortfolioTitleBarSvg (page title), so the PDF export follows for free.
// The dialog is portaled to <body> but its React parent is the page <svg>:
// click / double-click are stopped at the dialog root so they never reach the
// page selection handlers through synthetic bubbling.
export default function DialogEditPortfolioTitleBlock({
  open,
  onClose,
  page,
  layout,
  pageIndex,
  totalPages,
}) {
  // strings

  const titleS = "Cartouche";
  const helperS = "Cliquez dans une cellule pour modifier sa valeur.";

  // data

  const { value: portfolio } = useDisplayedPortfolio();
  const { value: project } = useSelectedProject();
  const manifest = useTitleBlockManifest(portfolio);
  const updateEntity = useUpdateEntity();

  // state

  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  // helpers

  const config = portfolio?.metadata || {};
  const logoUrl = usePortfolioLogoUrl(draft?.logo);
  const resolvedLogoSrc =
    logoUrl || (typeof draft?.logo === "string" ? draft.logo : null);

  // effects

  useEffect(() => {
    if (!open || !portfolio) return;
    setDraft({
      values: resolveTitleBlockFields(manifest, config),
      portfolioName: portfolio.name ?? "",
      pageTitle: page?.title ?? "",
      logo: config.logo ?? null,
    });
    setSaving(false);
  }, [open]);

  // handlers

  function handleLogoFile(file) {
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, logo: reader.result }));
    reader.readAsDataURL(file);
  }

  function handleLogoDelete() {
    setDraft((d) => ({ ...d, logo: null }));
  }

  async function handleSave() {
    if (!portfolio || !draft) return;
    setSaving(true);
    try {
      const storedValues = resolveTitleBlockFields(manifest, config);
      const valuesChanged = Object.keys(draft.values).some(
        (k) => (draft.values[k] ?? "") !== (storedValues[k] ?? "")
      );
      const logoChanged = draft.logo !== (config.logo ?? null);

      const listingPatch = {};
      if (draft.portfolioName !== (portfolio.name ?? "")) {
        listingPatch.name = draft.portfolioName;
      }
      if (valuesChanged || logoChanged) {
        listingPatch.metadata = {
          ...config,
          logo: draft.logo,
          titleBlock: {
            key: config.titleBlock?.key ?? manifest.key,
            values: draft.values,
          },
        };
      }
      if (Object.keys(listingPatch).length > 0) {
        await db.listings.update(portfolio.id, listingPatch);
      }
      if (page && draft.pageTitle !== (page.title ?? "")) {
        await updateEntity(
          page.id,
          { title: draft.pageTitle },
          { listing: portfolio }
        );
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // render

  if (!open || !portfolio || !draft || !layout?.cartouche) return null;

  const rect = {
    x: 0,
    y: 0,
    width: layout.cartouche.width,
    height: manifest.height,
  };
  const bindings = {
    "project.name": project?.name || "",
    "portfolio.name": draft.portfolioName,
    "page.title": draft.pageTitle,
    pageNum: totalPages
      ? `p. ${(pageIndex ?? 0) + 1} / ${totalPages}`
      : `p. ${(pageIndex ?? 0) + 1}`,
  };
  const layoutData = computeTitleBlockLayout(manifest, rect, {
    variant: layout.variant,
    values: draft.values,
    bindings,
    labelOverrides: config,
  });

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      title={titleS}
      width="min(92vw, 1000px)"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Box sx={{ px: 3, pb: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {helperS}
        </Typography>
      </Box>
      <Box sx={{ px: 3, pb: 2 }}>
        <svg
          viewBox={`-1 -1 ${rect.width + 2} ${rect.height + 2}`}
          width="100%"
          style={{ display: "block", overflow: "visible" }}
        >
          <TitleBlockEditableSvg
            layoutData={layoutData}
            style={manifest.style}
            logoUrl={resolvedLogoSrc}
            draft={draft}
            bindings={bindings}
            onDraftChange={setDraft}
            onLogoFile={handleLogoFile}
            onLogoDelete={handleLogoDelete}
          />
        </svg>
      </Box>
      <BottomBarCancelSave
        onCancel={onClose}
        onSave={handleSave}
        loading={saving}
      />
    </DialogGeneric>
  );
}
