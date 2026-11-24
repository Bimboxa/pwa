import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionReconstructionSteps from "./SectionReconstructionSteps";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import useReconstructionFrames from "../hooks/useReconstructionFrames";
import { RECONSTRUCTION_MEDIA_TYPES } from "../constants/reconstruction3dTool";
import {
  deleteReconstructionFrameService,
  hasReconstructionPose,
} from "../services/reconstructionFramesServices";

function formatTime(timeS) {
  const total = Math.max(0, Math.round(timeS * 10) / 10);
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

// Reconstruction 3D tool of the right band (Fonds de plan module): the
// images of the selected 3D reconstruction base map — the photos dropped in
// the tool or the frames sampled from the dropped video — as a grid of
// square thumbnails (a dot marks the images still without a camera, "x" on
// hover removes one), and the 3 steps of the Prompt IA round trip that
// rebuilds the scene (SectionReconstructionSteps).
export default function PanelReconstruction3d() {
  // strings

  const titleS = "Reconstruction 3D";
  const selectS = "Sélectionnez un fond de plan";
  const notReconstructionS =
    "Ce fond de plan n'est pas une reconstruction 3D. Créez un fond de plan « Reconstruction 3D » pour reconstruire une scène à partir de photos ou d'une vidéo.";
  const emptyS = "Aucune image";
  const removeS = "Supprimer";
  const noPoseS = "sans caméra";

  // data

  const baseMap = useMainBaseMap();
  const isReconstruction = Boolean(baseMap?.isReconstruction3d);
  const frames = useReconstructionFrames({
    baseMapId: isReconstruction ? baseMap.id : null,
  });

  // helpers

  const media = baseMap?.reconstruction3d ?? null;
  const video =
    media?.mediaType === RECONSTRUCTION_MEDIA_TYPES.VIDEO ? media.video : null;
  const hasModel = Boolean(baseMap?.scene3d?.glbFileName);
  const mediaS = video
    ? `Vidéo ${video.srcFileName ?? ""}${
        video.durationS ? ` — ${formatTime(video.durationS)}` : ""
      }${video.fileSize ? `, ${stringifyFileSize(video.fileSize)}` : ""}`
    : frames.length > 0
      ? `${frames.length} photo${frames.length > 1 ? "s" : ""}`
      : null;

  // render

  if (!baseMap || !isReconstruction) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {baseMap ? notReconstructionS : selectS}
        </Typography>
      </Box>
    );
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 0.5, pl: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {titleS}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {baseMap.name || "Fond de plan"}
        </Typography>
        {mediaS && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", overflowWrap: "anywhere" }}
          >
            {mediaS}
          </Typography>
        )}
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        {frames.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ px: 2, py: 1 }}
          >
            {emptyS}
          </Typography>
        )}

        {/* Square thumbnails; the hovered one shows a "x" */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: 0.5,
            px: 1.5,
            py: 0.5,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {frames.map((frame) => {
            const hasPose = hasReconstructionPose(frame);
            const timeLabel = Number.isFinite(frame.timeS)
              ? ` — ${formatTime(frame.timeS)}`
              : "";
            return (
              <Tooltip
                key={frame.id}
                title={`${frame.name}${timeLabel}${
                  hasModel && !hasPose ? ` — ${noPoseS}` : ""
                }`}
                placement="top"
                disableInteractive
              >
                <Box
                  sx={{
                    position: "relative",
                    aspectRatio: "1 / 1",
                    borderRadius: 1,
                    overflow: "hidden",
                    bgcolor: "grey.300",
                    backgroundImage: frame.image?.thumbnail
                      ? `url("${frame.image.thumbnail}")`
                      : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    "&:hover .reconstruction-frame-remove": { opacity: 1 },
                  }}
                >
                  <IconButton
                    className="reconstruction-frame-remove"
                    size="small"
                    title={removeS}
                    onClick={() => deleteReconstructionFrameService(frame)}
                    sx={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      p: "1px",
                      opacity: 0,
                      transition: "opacity 0.15s",
                      bgcolor: "rgba(255,255,255,0.85)",
                      "&:hover": { bgcolor: "common.white" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>

                  {/* name, on a dark band; a dot: no camera in the model */}
                  <Typography
                    variant="caption"
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      px: 0.5,
                      py: "1px",
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      fontSize: 10,
                      fontWeight: 700,
                      lineHeight: 1.4,
                      color: "common.white",
                      background:
                        "linear-gradient(transparent, rgba(0,0,0,0.65))",
                    }}
                  >
                    {hasModel && !hasPose && (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          flexShrink: 0,
                          borderRadius: "50%",
                          bgcolor: "warning.main",
                        }}
                      />
                    )}
                    {frame.name}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Box>

        <SectionReconstructionSteps baseMap={baseMap} frames={frames} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
