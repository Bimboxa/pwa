import { useState } from "react";

import { useDispatch } from "react-redux";

import { Box, Button, Typography } from "@mui/material";

import { setToaster } from "Features/layout/layoutSlice";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import reextendCutLineService from "../services/reextendCutLineService";

// Row of the floating toolbar for a selected CUT_LINE (no sub-selection):
// the count of drawn / extended points and « Recalculer le prolongement »
// (reextendCutLineService — the extension is run again from the drawn
// points on the current scene, e.g. after a vertex was dragged or the
// annotations around changed).
export default function ToolbarEditCutLine({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const recomputeS = "Recalculer le prolongement";
  const doneS = "Prolongement recalculé";
  const failedS = "Prolongement impossible (aucune face sous les extrémités)";

  // data

  const baseMaps = useBaseMaps()?.value;

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  const refs = annotation?.points || [];
  const derivedCount = refs.filter((p) => p?.derived).length;
  const drawnCount = refs.length - derivedCount;
  const countS = `${drawnCount} point${drawnCount > 1 ? "s" : ""} dessiné${drawnCount > 1 ? "s" : ""} · ${derivedCount} prolongé${derivedCount > 1 ? "s" : ""}`;

  // handlers

  async function handleRecompute() {
    const editor = getActiveThreedEditor();
    const baseMap = (baseMaps || []).find(
      (b) => b.id === annotation?.baseMapId
    );
    if (!editor || !baseMap) return;
    setBusy(true);
    try {
      const result = await reextendCutLineService({
        annotation,
        editor,
        baseMap,
      });
      const ok = result && result.derivedStart + result.derivedEnd > 0;
      dispatch(
        setToaster({
          message: ok ? doneS : failedS,
          severity: ok ? "success" : "warning",
        })
      );
    } catch (err) {
      console.error("[threedCutLines] re-extension failed", err);
      dispatch(setToaster({ message: failedS, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.25,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" color="text.secondary" noWrap>
        {countS}
      </Typography>
      <Box sx={{ flexGrow: 1 }} />
      <Button size="small" onClick={handleRecompute} disabled={busy}>
        {recomputeS}
      </Button>
    </Box>
  );
}
