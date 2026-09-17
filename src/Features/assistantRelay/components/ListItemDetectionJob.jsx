import { useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";

const STATUS_CHIP = {
  proposed: { label: "À importer", color: "primary" },
  applying: { label: "En cours", color: "info" },
  imported: { label: "Importée", color: "success" },
  rejected: { label: "Rejetée", color: "default" },
  failed: { label: "Échec", color: "error" },
};

// Live jobs (drawn / undone directly by ChatGPT, no manual import).
const LIVE_STATUS_CHIP = {
  proposed: { label: "Direct · en attente", color: "info" },
  applying: { label: "Direct · en cours", color: "info" },
  imported: { label: "Direct · appliquée", color: "success" },
  rejected: { label: "Direct · abandonnée", color: "default" },
  failed: { label: "Direct · échec", color: "error" },
};

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

export default function ListItemDetectionJob({
  job,
  listings,
  defaultListingId,
  actionStatus,
  isCurrentSnapshot,
  canImport,
  onImport,
  onReject,
}) {
  // strings

  const importS = "Importer";
  const rejectS = "Rejeter";
  const listingS = "Liste cible";
  const staleS =
    "Proposition faite sur un autre fond de plan que le fond de plan courant : l'import se fera sur ce fond de plan-là.";
  const undoS = "Annulation d'un dessin";
  const newListingS = "Nouvelle liste";
  const targetedListingS = "liste ciblée";

  // state

  const [listingId, setListingId] = useState(defaultListingId ?? "");
  const [lastError, setLastError] = useState(null);

  // helpers

  const isLive = Boolean(job.mode && job.mode !== "proposal");
  const chip =
    (isLive ? LIVE_STATUS_CHIP[job.status] : STATUS_CHIP[job.status]) ??
    STATUS_CHIP.proposed;
  const busy = actionStatus === "importing" || actionStatus === "rejecting";
  // Manual import controls: never for live jobs.
  const proposed = job.status === "proposed" && !isLive;
  const targetListingId = listingId || defaultListingId || "";
  // Live jobs may create a list (`listing.name`) or target one (`listing.id`).
  const countsLabel = `${job.annotationCount} annotation(s) · ${job.templateCount} template(s)`;
  const title =
    job.mode === "live_undo"
      ? undoS
      : job.listing?.name
        ? `${newListingS} « ${job.listing.name} » · ${job.templateCount} template(s)`
        : job.listing?.id
          ? `${countsLabel} · ${targetedListingS}`
          : countsLabel;

  // handlers

  async function handleImport() {
    setLastError(null);
    const result = await onImport(job.jobId, { listingId: targetListingId });
    if (result && !result.ok)
      setLastError(result.error ?? "Import impossible.");
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="body2" noWrap>
          {title}
        </Typography>
        <Chip size="small" label={chip.label} color={chip.color} />
      </Box>

      <Typography variant="caption" color="text.secondary">
        {formatDate(job.createdAt)}
        {job.note ? ` — ${job.note}` : ""}
      </Typography>

      {job.status === "failed" && job.error && (
        <Typography variant="caption" color="error">
          {job.error}
        </Typography>
      )}

      {proposed && !isCurrentSnapshot && (
        <Alert severity="info" sx={{ py: 0 }}>
          {staleS}
        </Alert>
      )}

      {proposed && (
        <>
          <FormControl size="small" fullWidth>
            <InputLabel>{listingS}</InputLabel>
            <Select
              label={listingS}
              value={targetListingId}
              onChange={(e) => setListingId(e.target.value)}
            >
              {(listings ?? []).map((l) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button size="small" disabled={busy} onClick={handleReject}>
              {rejectS}
            </Button>
            <Button
              size="small"
              variant="contained"
              disabled={busy || !canImport || !targetListingId}
              loading={actionStatus === "importing"}
              onClick={handleImport}
            >
              {importS}
            </Button>
          </Box>
        </>
      )}

      {lastError && (
        <Typography variant="caption" color="error">
          {lastError}
        </Typography>
      )}
    </Box>
  );
}
