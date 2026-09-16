import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { Box, Button, Divider, Typography } from "@mui/material";

import useCreateBaseMapFromRelayJob from "../hooks/useCreateBaseMapFromRelayJob";
import ListItemBaseMapJob from "./ListItemBaseMapJob";

// Base maps proposed from the ChatGPT component (create_base_map_from_pdf):
// the PWA rasterizes the PDF page itself and creates the base map on import.
export default function ListBaseMapJobs() {
  // strings

  const titleS = "Fonds de plan proposés par ChatGPT";
  const emptyS =
    "Aucun fond de plan proposé. Dans ChatGPT : « Crée un fond de plan à partir de ce PDF ».";
  const historyS = "Historique";
  const showS = "Afficher";
  const hideS = "Masquer";

  // data

  const jobsById = useSelector((s) => s.assistantRelay.baseMapJobsById);
  const actionStatusById = useSelector(
    (s) => s.assistantRelay.baseMapJobActionStatusById
  );
  const {
    createFromJob,
    rejectBaseMapJob,
    listings,
    defaultListingId,
    canImport,
  } = useCreateBaseMapFromRelayJob();

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

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2">{titleS}</Typography>
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
        <ListItemBaseMapJob
          key={job.jobId}
          job={job}
          listings={listings}
          defaultListingId={defaultListingId}
          actionStatus={actionStatusById?.[job.jobId]}
          canImport={canImport}
          onImport={createFromJob}
          onReject={rejectBaseMapJob}
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
              <ListItemBaseMapJob
                key={job.jobId}
                job={job}
                listings={listings}
                defaultListingId={defaultListingId}
                actionStatus={actionStatusById?.[job.jobId]}
                canImport={false}
                onImport={createFromJob}
                onReject={rejectBaseMapJob}
              />
            ))}
        </>
      )}
    </Box>
  );
}
