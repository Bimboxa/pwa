import {useSelector} from "react-redux";

import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  LinearProgress,
} from "@mui/material";
import {
  CloudUpload as Upload,
  CloudDownload as Download,
} from "@mui/icons-material";

export default function SectionSyncTasks() {
  // strings

  const noTaskS = "Tout est à jour";
  // data

  const syncTasks = useSelector((state) => state.sync.syncTasks);
  const preparing = useSelector((s) => s.sync.preparingSyncTasks);

  // helpers

  const noTasks = syncTasks?.length === 0;

  return (
    <Box>
      {preparing && <LinearProgress sx={{minWidth: 300}} />}
      {!preparing && noTasks && <Typography>{noTaskS}</Typography>}
      {!preparing && !noTasks && (
        <Box>
          {syncTasks?.map((syncTask) => {
            const syncing = syncTask.status === "SYNCING";
            const taskSucceed = syncTask.status === "DONE";
            const taskFailed = syncTask.status === "ERROR";
            const iconColor = syncing
              ? "primary.main"
              : taskSucceed
              ? "success.main"
              : taskFailed
              ? "error.main"
              : "background.default";
            const icon =
              syncTask.action === "PULL" ? (
                <Download sx={{color: iconColor}} />
              ) : (
                <Upload sx={{color: iconColor}} />
              );

            const label = syncTask.syncFileKey;
            return (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 1,
                  justifyContent: "space-between",
                }}
                key={label}
              >
                <Typography>{label}</Typography>
                <IconButton loading={syncing}>{icon}</IconButton>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
