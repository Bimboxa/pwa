import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCaptureTitleText } from "../mapEditorSlice";

import { Box, Typography } from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";
import TitleBlockEditableSvg from "Features/titleBlocks/components/TitleBlockEditableSvg";

import useCaptureTitleBlock from "../hooks/useCaptureTitleBlock";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";
import computeTitleBlockLayout from "Features/titleBlocks/utils/computeTitleBlockLayout";

// Edit the capture frame cartouche "in place", enlarged — capture-side twin
// of DialogEditPortfolioTitleBlock. Every editable cell is an input, changes
// live in a local draft and are written in one pass on save: field values +
// logo on the SCOPE (`scope.metadata.titleBlock.values` / `.logo`, so every
// capture of the scope shares them), the title into the capture tool's
// title text (the frame banner and the cartouche "Titre" cell read it).
// The dialog is portaled to <body> but its React parent is the overlay svg:
// click / double-click are stopped at the dialog root so they never reach
// the map underneath.
export default function DialogEditCaptureTitleBlock({
  open,
  onClose,
  hostViewerKey,
  cartoucheWidth,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Cartouche";
  const helperS = "Cliquez dans une cellule pour modifier sa valeur.";

  // data

  const { scope, manifest, metadata, values, defaultLogoUrl, bindings } =
    useCaptureTitleBlock(hostViewerKey);
  const captureTitleText = useSelector((s) => s.mapEditor.captureTitleText);
  const updateScope = useUpdateScope();

  // state

  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  // helpers

  // Scope logo (data URL) while set, else the org / portfolio default logo
  // — deleting the scope logo falls back to that default.
  const draftLogoSrc =
    (typeof draft?.logo === "string" && draft.logo) || defaultLogoUrl;

  // effects

  useEffect(() => {
    if (!open) return;
    setDraft({
      values: { ...values },
      pageTitle: captureTitleText ?? "",
      // null = no scope override (org default logo shown)
      logo: typeof metadata.logo === "string" ? metadata.logo : null,
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
    if (!draft) return;
    setSaving(true);
    try {
      const valuesChanged = Object.keys(draft.values).some(
        (k) => (draft.values[k] ?? "") !== (values[k] ?? "")
      );
      const storedLogo =
        typeof metadata.logo === "string" ? metadata.logo : null;
      const logoChanged = draft.logo !== storedLogo;

      if (scope && (valuesChanged || logoChanged)) {
        await updateScope({
          id: scope.id,
          metadata: {
            ...metadata,
            logo: draft.logo,
            titleBlock: {
              key: metadata.titleBlock?.key ?? manifest.key,
              values: draft.values,
            },
          },
        });
      }
      if (draft.pageTitle !== (captureTitleText ?? "")) {
        dispatch(setCaptureTitleText(draft.pageTitle));
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // render

  if (!open || !draft || !cartoucheWidth) return null;

  const rect = { x: 0, y: 0, width: cartoucheWidth, height: manifest.height };
  const draftBindings = { ...bindings, "page.title": draft.pageTitle };
  const layoutData = computeTitleBlockLayout(manifest, rect, {
    variant: "BOTTOM_RIGHT",
    mode: "CAPTURE",
    values: draft.values,
    bindings: draftBindings,
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
            logoUrl={draftLogoSrc}
            draft={draft}
            bindings={draftBindings}
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
