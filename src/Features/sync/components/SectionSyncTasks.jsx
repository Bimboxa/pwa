import {useState} from "react";
import {useSelector} from "react-redux";

import {
  Box,
  Typography,
  List,
  ListItem,
  IconButton,
  LinearProgress,
} from "@mui/material";

import {
  CloudUpload as Upload,
  CloudDownload as Download,
} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import CircularProgressGeneric from "Features/layout/components/CircularProgressGeneric";

export default function SectionSyncTasks() {
  // strings

  const noTaskS = "Tout est à jour";

  // state

  const [mode, setMode] = useState("PROGRESS"); // PROGRESS || LIST

  // data

  const syncTasks = useSelector((state) => state.sync.syncTasks);
  const preparing = useSelector((s) => s.sync.preparingSyncTasks);

  // helpers - activeTasks

  const activeTasks = syncTasks?.filter((t) =>
    ["PUSH", "PULL"].includes(t.action)
  ); // remove "UP_TO_DATE" actions

  // helpers

  const noTasks = syncTasks?.length === 0;

  // helpers - progress

  const tasks_done = activeTasks?.filter((t) => t.status === "DONE") ?? [];
  const progress =
    activeTasks?.length > 0
      ? (tasks_done.length / activeTasks.length) * 100
      : 0;

  return (
    <Box sx={{flexGrow: 1, display: "flex", flexDirection: "column"}}>
      {preparing && <LinearProgress sx={{minWidth: 300}} />}
      {!preparing && noTasks && (
        <Box sx={{p: 1}}>
          <Typography>{noTaskS}</Typography>
        </Box>
      )}
      {!preparing && !noTasks && (
        <BoxFlexVStretch>
          <Box sx={{p: 2}}>
            <ToggleSingleSelectorGeneric
              options={[
                {key: "PROGRESS", label: "Aperçu"},
                {key: "LIST", label: "Détail"},
              ]}
              selectedKey={mode}
              onChange={setMode}
            />
          </Box>

          {mode === "PROGRESS" && (
            <BoxCenter>
              <CircularProgressGeneric value={progress} />
            </BoxCenter>
          )}
          {mode === "LIST" && (
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
        </BoxFlexVStretch>
      )}
    </Box>
  );
}
