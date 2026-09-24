import { useEffect, useState } from "react";
import { CircularProgress, Stack, Typography } from "@mui/material";
import { getChatProgressLabel, formatChatElapsed } from "../utils/chatProgress";

export default function ThinkingBubble({ progress }) {
  const [mountedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const label = getChatProgressLabel(progress);
  return (
    <Stack spacing={0.5} sx={{ py: 1, minWidth: 0, color: "text.secondary" }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ minWidth: 0, flexWrap: "nowrap" }}
      >
        <CircularProgress
          size={14}
          color="inherit"
          aria-hidden="true"
          sx={{
            flexShrink: 0,
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              "& .MuiCircularProgress-circle": { animation: "none" },
            },
          }}
        />
        <Typography
          variant="body2"
          role="status"
          noWrap
          title={label}
          sx={{ flex: "1 1 0%", minWidth: 0 }}
        >
          {label}
        </Typography>
        <Typography
          variant="body2"
          role="timer"
          aria-label="Temps écoulé"
          sx={{
            flexShrink: 0,
            minWidth: "6ch",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {formatChatElapsed(progress?.startedAt ?? mountedAt, now)}
        </Typography>
      </Stack>
      {progress?.model && (
        <Typography variant="caption" noWrap title={progress.model}>
          {progress.model}
        </Typography>
      )}
    </Stack>
  );
}
