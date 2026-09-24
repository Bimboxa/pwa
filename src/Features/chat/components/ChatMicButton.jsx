import { IconButton } from "@mui/material";
import { Mic as MicIcon, MicNone as MicNoneIcon } from "@mui/icons-material";

// Dictation toggle under the chat input: grey when off, pulsing red while the
// microphone is listening, disabled when the browser has no Web Speech API.
export default function ChatMicButton({ supported, listening, onToggle }) {
  // strings

  const startS = "Dicter le message";
  const stopS = "Arrêter la dictée";
  const unsupportedS = "Dictée non supportée par ce navigateur";

  // render

  const title = !supported ? unsupportedS : listening ? stopS : startS;

  return (
    // A disabled IconButton swallows its title: the span keeps the tooltip.
    <span title={title}>
      <IconButton
        size="small"
        aria-label={title}
        aria-pressed={listening}
        disabled={!supported}
        onClick={onToggle}
        sx={{
          width: 26,
          height: 26,
          borderRadius: "8px",
          color: listening ? "error.main" : "text.secondary",
          "&:hover": { color: listening ? "error.light" : "text.primary" },
          ...(listening && {
            animation: "chatMicPulse 1.4s ease-in-out infinite",
            "@keyframes chatMicPulse": {
              "0%": { boxShadow: "0 0 0 0 rgba(244, 67, 54, 0.45)" },
              "70%": { boxShadow: "0 0 0 8px rgba(244, 67, 54, 0)" },
              "100%": { boxShadow: "0 0 0 0 rgba(244, 67, 54, 0)" },
            },
          }),
        }}
      >
        {listening ? (
          <MicIcon sx={{ fontSize: 18 }} />
        ) : (
          <MicNoneIcon sx={{ fontSize: 18 }} />
        )}
      </IconButton>
    </span>
  );
}
