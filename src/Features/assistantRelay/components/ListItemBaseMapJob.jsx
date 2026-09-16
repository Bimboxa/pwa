import { useEffect, useState } from "react";

import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

import { fetchBaseMapJobPreview } from "../services/assistantRelayClient";

const STATUS_CHIP = {
  proposed: { label: "À importer", color: "primary" },
  imported: { label: "Importé", color: "success" },
  rejected: { label: "Rejeté", color: "default" },
  failed: { label: "Échec", color: "error" },
};

const ACTION_LABEL = {
  downloading: "Téléchargement du PDF…",
  rendering: "Rendu de la page…",
  creating: "Création du fond de plan…",
  publishing: "Publication vers ChatGPT…",
  rejecting: "Rejet…",
};

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function describeFrame(frame) {
  if (!frame) return "";
  const parts = [`page ${frame.pageNumber}`];
  if (frame.rotation) parts.push(`rotation ${frame.rotation}°`);
  const b = frame.bboxInRatio;
  if (b && (b.x1 > 0 || b.y1 > 0 || b.x2 < 1 || b.y2 < 1)) {
    parts.push(
      `cadrage ${Math.round((b.x2 - b.x1) * 100)}×${Math.round(
        (b.y2 - b.y1) * 100
      )} %`
    );
  }
  parts.push(frame.blueprintScale ? `1:${frame.blueprintScale}` : "échelle ?");
  parts.push(frame.dpi ? `${frame.dpi} dpi` : "résolution auto");
  return parts.join(" · ");
}

export default function ListItemBaseMapJob({
  job,
  listings,
  defaultListingId,
  actionStatus,
  canImport,
  onImport,
  onReject,
}) {
  // strings

  const importS = "Importer";
  const rejectS = "Rejeter";
  const retryS = "Réessayer";
  const listingS = "Liste de fonds de plan cible";
  const newListingS = "Nouvelle liste (par défaut)";

  // state

  const [listingId, setListingId] = useState(defaultListingId ?? "");
  const [lastError, setLastError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // helpers

  const chip = STATUS_CHIP[job.status] ?? STATUS_CHIP.proposed;
  const busy = Boolean(ACTION_LABEL[actionStatus]);
  const proposed = job.status === "proposed";
  const targetListingId = listingId || defaultListingId || "";

  useEffect(() => {
    if (!job.hasPreview) return undefined;
    let url;
    let cancelled = false;
    fetchBaseMapJobPreview(job.jobId)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [job.jobId, job.hasPreview]);

  // handlers

  async function handleImport() {
    setLastError(null);
    setNotice(null);
    const result = await onImport(job.jobId, { listingId: targetListingId });
    if (result && !result.ok) {
      setLastError(result.error ?? "Import impossible.");
    } else if (result?.publishError) {
      setNotice(
        `Fond de plan créé, mais publication vers ChatGPT impossible : ${result.publishError}. Utilisez « Publier » ci-dessus.`
      );
    } else if (result?.reused) {
      setNotice(
        "Fond de plan déjà créé pour cette proposition : accusé renvoyé."
      );
    }
  }

  async function handleReject() {
    setLastError(null);
    const result = await onReject(job.jobId);
    if (result && !result.ok) setLastError(result.error ?? "Rejet impossible.");
  }

  // render

  return (
    <Box
      sx={{
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        {previewUrl && (
          <Box
            component="img"
            src={previewUrl}
            alt=""
            sx={{
              width: 72,
              height: 72,
              objectFit: "contain",
              bgcolor: "common.white",
              borderRadius: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              flexShrink: 0,
            }}
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
            }}
          >
            <Typography variant="body2" noWrap fontWeight={500}>
              {job.name}
            </Typography>
            <Chip size="small" label={chip.label} color={chip.color} />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block">
            {describeFrame(job.frame)}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            noWrap
          >
            {job.pdfFileName} · {formatDate(job.createdAt)}
          </Typography>
        </Box>
      </Box>

      {job.status === "failed" && job.error && (
        <Typography variant="caption" color="error">
          {job.error}
        </Typography>
      )}

      {proposed && (
        <>
          <FormControl size="small" fullWidth>
            <InputLabel>{listingS}</InputLabel>
            <Select
              label={listingS}
              value={
                listings?.some((l) => l.id === targetListingId)
                  ? targetListingId
                  : ""
              }
              onChange={(e) => setListingId(e.target.value)}
            >
              {(listings ?? []).map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
              {(!listings || listings.length === 0) && (
                <MenuItem value="">{newListingS}</MenuItem>
              )}
            </Select>
          </FormControl>

          {busy && (
            <Typography variant="caption" color="text.secondary">
              {ACTION_LABEL[actionStatus]}
            </Typography>
          )}

          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button size="small" disabled={busy} onClick={handleReject}>
              {rejectS}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={busy || !canImport}
              onClick={handleImport}
            >
              {actionStatus === "error" ? retryS : importS}
            </Button>
          </Box>
        </>
      )}

      {notice && (
        <Typography variant="caption" color="text.secondary">
          {notice}
        </Typography>
      )}
      {lastError && (
        <Typography variant="caption" color="error">
          {lastError}
        </Typography>
      )}
    </Box>
  );
}
