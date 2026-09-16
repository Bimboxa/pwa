import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { Box, Button, Chip, Divider, Typography } from "@mui/material";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";

import useImportDetectionJob from "../hooks/useImportDetectionJob";
import ListItemDetectionJob from "./ListItemDetectionJob";

const REALTIME_LABEL = {
  subscribed: { label: "Temps réel", color: "success" },
  unavailable: { label: "Polling", color: "default" },
  error: { label: "Temps réel : erreur", color: "warning" },
};

export default function ListDetectionJobs({ realtimeStatus }) {
  // strings

  const titleS = "Propositions de ChatGPT";
  const emptyS =
    "Aucune proposition. Dans ChatGPT : « Récupère le fond de plan courant et détecte les annotations ».";
  const historyS = "Historique";
  const showS = "Afficher";
  const hideS = "Masquer";

  // data

  const jobsById = useSelector((s) => s.assistantRelay.jobsById);
  const actionStatusById = useSelector(
    (s) => s.assistantRelay.jobActionStatusById
  );
  const currentSnapshot = useSelector((s) => s.assistantRelay.currentSnapshot);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  // Same listing set as the "Import annotations" panel.
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });
  const { importJob, rejectJob, canImport } = useImportDetectionJob();

  // state

  const [showHistory, setShowHistory] = useState(false);

  // helpers

  const { proposed, history } = useMemo(() => {
    const all = Object.values(jobsById ?? {}).sort((a, b) =>
      (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
    );
    return {
      proposed: all.filter((j) => j.status === "proposed"),
      history: all.filter((j) => j.status !== "proposed"),
    };
  }, [jobsById]);

  const defaultListingId =
    (selectedListingId && listings?.some((l) => l.id === selectedListingId)
      ? selectedListingId
      : listings?.[0]?.id) ?? "";

  const realtimeChip = REALTIME_LABEL[realtimeStatus];

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box
        sx={{
          p: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="subtitle2">{titleS}</Typography>
        {realtimeChip && (
          <Chip
            size="small"
            variant="outlined"
            label={realtimeChip.label}
            color={realtimeChip.color}
          />
        )}
      </Box>

      {proposed.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 1, pb: 1 }}
        >
          {emptyS}
        </Typography>
      )}

      {proposed.map((job) => (
        <ListItemDetectionJob
          key={job.jobId}
          job={job}
          listings={listings}
          defaultListingId={defaultListingId}
          actionStatus={actionStatusById?.[job.jobId]}
          isCurrentSnapshot={
            !currentSnapshot || job.snapshotId === currentSnapshot.snapshotId
          }
          canImport={canImport}
          onImport={importJob}
          onReject={rejectJob}
        />
      ))}

      {history.length > 0 && (
        <>
          <Divider />
          <Box
            sx={{
              px: 1,
              py: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {historyS} ({history.length})
            </Typography>
            <Button size="small" onClick={() => setShowHistory((v) => !v)}>
              {showHistory ? hideS : showS}
            </Button>
          </Box>
          {showHistory &&
            history.map((job) => (
              <ListItemDetectionJob
                key={job.jobId}
                job={job}
                listings={listings}
                defaultListingId={defaultListingId}
                actionStatus={actionStatusById?.[job.jobId]}
                isCurrentSnapshot
                canImport={false}
                onImport={importJob}
                onReject={rejectJob}
              />
            ))}
        </>
      )}
    </Box>
  );
}
