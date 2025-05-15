import {useSelector} from "react-redux";

import {
  Box,
  Typography,
  CircularProgress,
  List,
  ListItem,
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

  // helpers - activeTasks

  const activeTasks = syncTasks?.filter((t) =>
    ["PUSH", "PULL"].includes(t.action)
  ); // remove "UP_TO_DATE" actions

  // helpers

  const noTasks = syncTasks?.length === 0;

  return (
    <Box>
      {preparing && <LinearProgress sx={{minWidth: 300}} />}
      {!preparing && noTasks && <Typography>{noTaskS}</Typography>}
      {!preparing && !noTasks && (
        <List>
          {activeTasks?.map((syncTask) => {
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
              <ListItem
                divider
                sx={{
                  display: "flex",
                  alignItems: "center",
                  p: 1,
                  justifyContent: "space-between",
                }}
                key={syncTask.id}
              >
                <Typography>{label}</Typography>
                <IconButton loading={syncing}>{icon}</IconButton>
              </ListItem>
            );
          })}
        </List>
      )}
    </Box>
  );
}
