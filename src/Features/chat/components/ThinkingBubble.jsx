import { useEffect, useState } from "react";
import { CircularProgress, Stack, Typography } from "@mui/material";
import { CHAT_PROGRESS_LABELS, formatChatElapsed } from "../utils/chatProgress";

export default function ThinkingBubble({ progress }) {
  const [mountedAt] = useState(Date.now);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Stack spacing={0.5} sx={{ py: 1, color: "text.secondary" }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <CircularProgress
          size={14}
          color="inherit"
          aria-hidden="true"
          sx={{
            "@media (prefers-reduced-motion: reduce)": {
              animation: "none",
              "& .MuiCircularProgress-circle": { animation: "none" },
            },
          }}
        />
        <Typography variant="body2" role="status">
          {CHAT_PROGRESS_LABELS[progress?.stage] ?? "krtographing..."}
        </Typography>
        <Typography
          variant="body2"
          role="timer"
          aria-label="Temps écoulé"
          sx={{
            ml: "auto",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {formatChatElapsed(progress?.startedAt ?? mountedAt, now)}
        </Typography>
      </Stack>
      {progress?.model && (
        <Typography variant="caption">{progress.model}</Typography>
      )}
    </Stack>
  );
}
