import {useSelector} from "react-redux";

import {Box, Typography, CircularProgress} from "@mui/material";

export default function SectionSyncTasks() {
  // data

  const syncTasks = useSelector((state) => state.sync.syncTasks);
  console.log("[syncTasks] syncTasks", syncTasks);

  return (
    <Box>
      <Typography>...</Typography>
      {syncTasks?.map((syncTask) => {
        const status = syncTask.status;
        const label = syncTask.label;
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
            <Typography>{status}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}
