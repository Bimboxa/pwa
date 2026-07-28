import { Box, Typography } from "@mui/material";
import { PlayArrow, Category } from "@mui/icons-material";

import getVideoEmbed from "../utils/getVideoEmbed";

// Left column of the object dialog: thumbnail + description on top, tutorial
// video (or a placeholder player) below.
export default function SectionObjectMedia({ object }) {
  // data

  const video = getVideoEmbed(object.videoUrl);

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <Box
          sx={{
            width: 160,
            height: 160,
            flex: "none",
            borderRadius: 2,
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {object.thumbnailUrl ? (
            <Box
              component="img"
              src={object.thumbnailUrl}
              alt={object.label}
              sx={{ width: "80%", height: "80%", objectFit: "contain" }}
            />
          ) : (
            <Category sx={{ fontSize: 56, color: "text.disabled" }} />
          )}
        </Box>

        {/* pre-line: manifest descriptions may carry line breaks + bullets. */}
        <Typography
          variant="body1"
          sx={{ flex: 1, minWidth: 0, whiteSpace: "pre-line" }}
        >
          {object.description}
        </Typography>
      </Box>

      <Box
        sx={{
          position: "relative",
          width: 1,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "#1e1e1e",
          aspectRatio: "16 / 9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {video?.kind === "IFRAME" ? (
          <iframe
            src={video.src}
            title={`Tutoriel — ${object.label}`}
            allow="autoplay; fullscreen"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : video?.kind === "FILE" ? (
          <video
            src={video.src}
            controls
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        ) : (
          <>
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                top: 8,
                left: 12,
                color: "rgba(255,255,255,0.85)",
              }}
            >
              Tutoriel — Comment dessiner {object.label}
            </Typography>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: 6,
              }}
            >
              <PlayArrow sx={{ color: "#fff", fontSize: 40 }} />
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
