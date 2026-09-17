import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

import { updateMessageById } from "../chatSlice";

import {
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import ImportAnnotationsPreview from "Features/importAnnotations/components/ImportAnnotationsPreview";
import ImportAnnotationsTemplateList from "Features/importAnnotations/components/ImportAnnotationsTemplateList";
import useCreateBaseMapFromRelayJob from "Features/assistantRelay/hooks/useCreateBaseMapFromRelayJob";
import renderPdfPagePreview from "Features/assistantRelay/services/renderPdfPagePreview";
import {
  confirmVectorization,
  describeRelayError,
  dismissVectorization,
  fetchRelayPdf,
  fetchVectorizationPreview,
} from "Features/assistantRelay/services/assistantRelayClient";

// Shown when a run is `ready`: what the model found, drawn over the PDF page,
// before anything is created in the project. "Créer" hands over to the relay
// runtime (base map from the run's base map job, then the annotations job).
export default function ChatVectorizationCard({ message }) {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer le fond et importer";
  const dismissS = "Ignorer";
  const listingS = "Liste de fonds de plan";
  const defaultListingS = "Liste par défaut";

  // data

  const run = message.run;
  const runId = run?.runId;
  const { listings, defaultListingId } = useCreateBaseMapFromRelayJob();

  // state

  const [data, setData] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null);
  const [excludedTemplateIds, setExcludedTemplateIds] = useState([]);
  const [listingId, setListingId] = useState(
    run?.target?.baseMapListingId ?? ""
  );
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!listingId && defaultListingId) setListingId(defaultListingId);
  }, [listingId, defaultListingId]);

  // The vectors first (small), the page picture when it is ready (a dense
  // plan takes a few seconds to rasterize).
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let url = null;
    (async () => {
      try {
        const preview = await fetchVectorizationPreview(runId);
        if (cancelled) return;
        setData(preview);
      } catch (e) {
        if (!cancelled) setError(e?.code ? describeRelayError(e) : e?.message);
        return;
      }
      try {
        const pdfBlob = await fetchRelayPdf(run.sourcePdfId);
        url = await renderPdfPagePreview({
          pdfBlob,
          pageNumber: run.frame?.pageNumber ?? 1,
          rotation: run.frame?.rotation ?? 0,
        });
        if (cancelled) URL.revokeObjectURL(url);
        else setBackgroundUrl(url);
      } catch (e) {
        console.log("[chat] page preview failed", e);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [runId]);

  // helpers

  const templates = useMemo(() => {
    const counts = new Map();
    for (const a of data?.annotations ?? []) {
      counts.set(
        a.annotationTemplateId,
        (counts.get(a.annotationTemplateId) ?? 0) + 1
      );
    }
    return (data?.annotationTemplates ?? []).map((t) => ({
      ...t,
      label: `${t.label ?? t.id} (${counts.get(t.id) ?? 0})`,
    }));
  }, [data]);

  const excluded = new Set(excludedTemplateIds);
  const includedCount = (data?.annotations ?? []).filter(
    (a) => !excluded.has(a.annotationTemplateId)
  ).length;
  const widthMeters = data?.image?.widthMeters;

  // handlers

  function handleToggle(templateId) {
    setExcludedTemplateIds((ids) =>
      ids.includes(templateId)
        ? ids.filter((id) => id !== templateId)
        : [...ids, templateId]
    );
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const next = await confirmVectorization(runId, { excludedTemplateIds });
      dispatch(
        updateMessageById({
          id: message.id,
          changes: {
            run: next,
            confirmed: true,
            baseMapListingId: listingId || null,
          },
        })
      );
    } catch (e) {
      setError(e?.code ? describeRelayError(e) : e?.message);
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    setError(null);
    try {
      const next = await dismissVectorization(runId);
      dispatch(updateMessageById({ id: message.id, changes: { run: next } }));
    } catch (e) {
      setError(e?.code ? describeRelayError(e) : e?.message);
      setBusy(false);
    }
  }

  // render

  return (
    <Box
      sx={{
        mt: 1.5,
        p: 1,
        borderRadius: 1,
        backgroundColor: "#2b2b2b",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      {data ? (
        <>
          <Typography variant="body2">
            {includedCount} annotation{includedCount > 1 ? "s" : ""} ·{" "}
            {templates.length - excludedTemplateIds.length} modèle
            {templates.length - excludedTemplateIds.length > 1 ? "s" : ""}
            {widthMeters
              ? ` · largeur ${Number(widthMeters).toFixed(2)} m`
              : " · échelle inconnue"}
          </Typography>
          <ImportAnnotationsPreview
            data={data}
            widthMeters={widthMeters}
            excludedTemplateIds={excludedTemplateIds}
            backgroundUrl={backgroundUrl}
          />
          <ImportAnnotationsTemplateList
            templates={templates}
            excludedTemplateIds={excludedTemplateIds}
            onToggle={handleToggle}
          />
          {listings?.length > 1 ? (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {listingS}
              </Typography>
              <Select
                size="small"
                variant="standard"
                fullWidth
                displayEmpty
                value={listingId}
                onChange={(e) => setListingId(e.target.value)}
              >
                {!listingId ? (
                  <MenuItem value="">{defaultListingS}</MenuItem>
                ) : null}
                {listings.map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          ) : null}
        </>
      ) : !error ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : null}

      {error ? (
        <Typography variant="body2" color="error">
          {error}
        </Typography>
      ) : null}

      <Stack direction="row" spacing={1} justifyContent="flex-end">
        <Button size="small" disabled={busy} onClick={handleDismiss}>
          {dismissS}
        </Button>
        <Button
          size="small"
          variant="contained"
          color="secondary"
          disabled={busy || !data || includedCount === 0}
          onClick={handleCreate}
        >
          {createS}
        </Button>
      </Stack>
    </Box>
  );
}
