import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  setOpenBaseMapCreator,
  setCreating,
  setRegenerateDpi,
} from "../baseMapCreatorSlice";

import { Alert, Box, Divider, Typography, CircularProgress } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldOptionKey from "Features/form/components/FieldOptionKey";

import db from "App/db/db";
import { countBaseMapAnnotations } from "Features/baseMaps/hooks/useDeleteBaseMap";
import regenerateBaseMapFromPdfPageService from "Features/baseMaps/services/regenerateBaseMapFromPdfPageService";
import { normalizeBbox } from "Features/baseMaps/utils/baseMapFrameTransform";

const DPI_OPTIONS = [72, 150, 300, 600];

// Right column of the creator in "regenerate" mode: dpi choice, what will
// change, and the commit button.
export default function SectionRegenerateBaseMap({ pdfDocument }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Régénérer le fond de plan";
  const dpiS = "Résolution";
  const currentS = "Image actuelle";
  const nextS = "Nouvelle image";
  const warningS =
    "Les annotations de toutes les scopes dessinées sur ce fond de plan seront déplacées pour rester alignées sur le dessin.";
  const validateS = "Valider";
  const runningS = "Régénération…";
  const closeHintS = "Cette action ferme le dialogue.";

  // data

  const regenerate = useSelector((s) => s.baseMapCreator.regenerate);
  const bboxInRatio = useSelector((s) => s.baseMapCreator.bboxInRatio);
  const rotate = useSelector((s) => s.baseMapCreator.rotate);
  const creating = useSelector((s) => s.baseMapCreator.creating);

  const baseMapId = regenerate?.baseMapId;
  const createdFrom = regenerate?.createdFrom;
  const dpi = regenerate?.dpi ?? createdFrom?.dpi ?? 72;

  const info = useLiveQuery(async () => {
    if (!baseMapId) return null;
    const record = await db.baseMaps.get(baseMapId);
    const annotationCount = await countBaseMapAnnotations(baseMapId);
    return { record, annotationCount };
  }, [baseMapId]);

  // state

  const [error, setError] = useState(null);
  // page size at scale 1 (for the size estimate)
  const [pageSize, setPageSize] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPageSize(null);
    if (!pdfDocument) return undefined;
    pdfDocument
      .getPage(createdFrom?.pageNumber ?? 1)
      .then((page) => {
        if (cancelled) return;
        const vp = page.getViewport({ scale: 1, rotation: rotate ?? 0 });
        setPageSize({ width: vp.width, height: vp.height });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdfDocument, createdFrom?.pageNumber, rotate]);

  // helpers

  const dpiValues = [...new Set([...DPI_OPTIONS, createdFrom?.dpi].filter(Boolean))].sort(
    (a, b) => a - b
  );
  const dpiOptions = dpiValues.map((v) => ({
    key: String(v),
    label: v === createdFrom?.dpi ? `${v} DPI (actuel)` : `${v} DPI`,
  }));

  const record = info?.record;
  const currentSizeS = record?.refWidth
    ? `${record.refWidth} × ${record.refHeight} px`
    : "—";
  let nextSizeS = "—";
  if (pageSize) {
    const b = normalizeBbox(bboxInRatio);
    const w = Math.floor((b.x2 - b.x1) * pageSize.width * (dpi / 72));
    const h = Math.floor((b.y2 - b.y1) * pageSize.height * (dpi / 72));
    nextSizeS = `${w} × ${h} px`;
  }
  const annotationCount = info?.annotationCount ?? 0;

  // handlers

  async function handleValidate() {
    if (!baseMapId) return;
    setError(null);
    dispatch(setCreating(true));
    try {
      await regenerateBaseMapFromPdfPageService({
        baseMapId,
        bboxInRatio,
        dpi: Number(dpi),
        dispatch,
      });
      dispatch(setCreating(false));
      dispatch(setOpenBaseMapCreator(false));
    } catch (e) {
      console.error("[baseMaps] regenerate failed", e);
      setError(e?.message ?? String(e));
      dispatch(setCreating(false));
    }
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        bgcolor: "background.paper",
      }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="subtitle2">{titleS}</Typography>
        <Typography variant="body2" color="text.secondary" noWrap>
          {regenerate?.baseMapName}
        </Typography>
      </Box>
      <Divider />

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
          <Typography variant="body2">{dpiS}</Typography>
          <FieldOptionKey
            value={String(dpi)}
            onChange={(key) => dispatch(setRegenerateDpi(Number(key)))}
            valueOptions={dpiOptions}
          />
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            {currentS}
          </Typography>
          <Typography variant="body2">{currentSizeS}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {nextS}
          </Typography>
          <Typography variant="body2">{nextSizeS}</Typography>
        </Box>

        {annotationCount > 0 && (
          <Alert severity="info" sx={{ fontSize: 12 }}>
            {annotationCount} annotation(s) sur ce fond de plan. {warningS}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ fontSize: 12 }}>
            {error}
          </Alert>
        )}
      </Box>

      <Box
        sx={{
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        <ButtonGeneric
          size="large"
          fullWidth
          label={creating ? runningS : validateS}
          onClick={handleValidate}
          variant="contained"
          color="primary"
          disabled={creating || !baseMapId}
          startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
        />
        <Typography variant="caption" color="text.secondary">
          {closeHintS}
        </Typography>
      </Box>
    </Box>
  );
}
