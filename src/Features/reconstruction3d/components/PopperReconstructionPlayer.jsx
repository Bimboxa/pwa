import { useEffect, useMemo, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  RECONSTRUCTION_PULL_BACK_MAX_M,
  bumpReconstructionVideoVersion,
  setReconstructionCoupled,
  setReconstructionPullBackM,
} from "../reconstruction3dSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

import {
  Box,
  Button,
  IconButton,
  Paper,
  Slider,
  Tooltip,
  Typography,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";

import PanelFooter from "Features/layout/components/PanelFooter";

import getPanelAutoMaxHeight from "Features/layout/utils/getPanelAutoMaxHeight";
import usePanelDrag from "Features/layout/hooks/usePanelDrag";
import usePanelResize from "Features/layout/hooks/usePanelResize";
import usePhotoImageUrl from "Features/photos/hooks/usePhotoImageUrl";
import useReconstructionCameraCoupling from "../hooks/useReconstructionCameraCoupling";
import useReconstructionVideoUrl from "../hooks/useReconstructionVideoUrl";
import getCameraPathPoseAtTime, {
  getCameraPathSamples,
} from "../utils/getCameraPathPoseAtTime";
import { RECONSTRUCTION_MEDIA_TYPES } from "../constants/reconstruction3dTool";
import {
  hasReconstructionPose,
  reloadReconstructionVideoService,
} from "../services/reconstructionFramesServices";

const POPPER_WIDTH = 420;
const RIGHT_GAP = 12;
const TOP = 50;

function formatTime(timeS) {
  const total = Math.max(0, timeS || 0);
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// PopperReconstructionPlayer — floating player of a 3D reconstruction base
// map, opened from the bottom bar (reconstruction3d.showPlayer).
// - Video reconstruction, the video on this device: the video itself, with
//   play / pause and a progress bar. Each time of the video maps to a camera
//   (linear interpolation between the frames the AI located, see
//   getCameraPathPoseAtTime).
// - Photos reconstruction — or a video whose file is not on this device
//   (then offered to be loaded again): the images one by one, each with its
//   own camera.
// In the 3D editor, while « coupled », the displayed time / image drives the
// 3D camera (useReconstructionCameraCoupling); navigating by hand in the 3D
// view uncouples, the link button couples again.
// ---------------------------------------------------------------------------
export default function PopperReconstructionPlayer({
  baseMap,
  frames,
  is3dEditor,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Reconstruction 3D";
  const playS = "Lire";
  const pauseS = "Pause";
  const prevS = "Image précédente";
  const nextS = "Image suivante";
  const coupledS = "Caméra 3D couplée à la lecture — cliquer pour la libérer";
  const uncoupledS = "Coupler la caméra 3D à la lecture";
  const only3dS = "Le couplage de la caméra est disponible dans la vue 3D";
  const noPoseS =
    "Aucune caméra : chargez le zip renvoyé par l'IA (outil Reconstruction 3D)";
  const walkS = "Couplage indisponible en mode marche";
  const pullBackS = "Recul de la caméra 3D par rapport à la prise de vue";
  const missingVideoS = "La vidéo n'est pas sur cet appareil.";
  const reloadVideoS = "Recharger la vidéo";
  const noImageS = "Aucune image";
  const noCameraTagS = "sans caméra";

  // data

  const coupled = useSelector((s) => s.reconstruction3d.coupled);
  // `?? 0`: a store created before the setting existed (hot reload)
  const storedPullBackM = useSelector(
    (s) => s.reconstruction3d.pullBackM ?? 0
  );
  const videoVersion = useSelector((s) => s.reconstruction3d.videoVersion);
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  // The open right tool drawer slides over the editor: step aside.
  const rightDrawerWidth = useSelector((s) =>
    s.rightPanel.selectedMenuItemKey ? s.rightPanel.width : 0
  );

  const media = baseMap.reconstruction3d ?? null;
  const video =
    media?.mediaType === RECONSTRUCTION_MEDIA_TYPES.VIDEO ? media.video : null;
  const videoUrl = useReconstructionVideoUrl(video?.fileName, videoVersion);

  // state

  const videoRef = useRef(null);
  const reloadInputRef = useRef(null);
  const [timeS, setTimeS] = useState(0);
  const [durationS, setDurationS] = useState(video?.durationS ?? 0);
  const [playing, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  // Value of the pull-back slider while it is dragged: kept local (the 3D
  // camera follows at once), stored when the drag ends.
  const [pullBackDraftM, setPullBackDraftM] = useState(null);
  const pullBackM = pullBackDraftM ?? storedPullBackM;
  const { position, isDragging, handleMouseDown } = usePanelDrag();
  const paperRef = useRef(null);
  const {
    size,
    isAutoHeight,
    handleResizeMouseDown,
    fitContent,
    reset: resetSize,
  } = usePanelResize({
    paperRef,
    minWidth: 260,
    minHeight: 200,
    anchor: "right",
  });

  // helpers

  const isVideoMode = Boolean(video && videoUrl);
  const isVideoMissing = Boolean(video) && videoUrl === null;
  const samples = useMemo(() => getCameraPathSamples(frames), [frames]);
  const posedCount = useMemo(
    () => frames.filter(hasReconstructionPose).length,
    [frames]
  );
  const canCouple = is3dEditor && posedCount > 0 && !walkActive;
  const coupling = canCouple && coupled;
  const applyPose = useReconstructionCameraCoupling({
    baseMapId: baseMap.id,
    active: coupling,
    pullBackM,
  });

  const safeIndex = Math.min(frameIndex, Math.max(0, frames.length - 1));
  const frame = frames[safeIndex] ?? null;
  const frameUrl = usePhotoImageUrl(
    isVideoMode ? null : frame?.image?.fileName
  );
  const stop = (e) => e.stopPropagation();

  const coupleTitle = !is3dEditor
    ? only3dS
    : posedCount === 0
      ? noPoseS
      : walkActive
        ? walkS
        : coupled
          ? coupledS
          : uncoupledS;

  // effects

  // Video mode: the time of the <video> is the source of truth — read at
  // every animation frame while the panel is opened (playing, seeking and
  // the progress bar all end up there). The camera follows; a pose that
  // could not be applied yet (3D model still loading) is tried again.
  const appliedTimeRef = useRef(null);
  useEffect(() => {
    appliedTimeRef.current = null;
  }, [coupling, samples, pullBackM]);

  useEffect(() => {
    if (!isVideoMode) return undefined;
    let raf = null;
    let lastShown = null;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const element = videoRef.current;
      if (!element) return;
      const current = element.currentTime;
      if (current !== lastShown) {
        lastShown = current;
        setTimeS(current);
      }
      if (coupling && appliedTimeRef.current !== current) {
        const pose = getCameraPathPoseAtTime(samples, current);
        if (pose && applyPose(pose)) appliedTimeRef.current = current;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isVideoMode, coupling, samples, applyPose]);

  // Images mode: the camera of the displayed image (retried while the 3D
  // model is still loading).
  useEffect(() => {
    if (isVideoMode || !coupling || !hasReconstructionPose(frame))
      return undefined;
    let timer = null;
    let tries = 0;
    const apply = () => {
      if (applyPose(frame.pose) || tries++ > 20) return;
      timer = setTimeout(apply, 250);
    };
    apply();
    return () => clearTimeout(timer);
  }, [isVideoMode, coupling, frame, applyPose, pullBackM]);

  // handlers

  function handleTogglePlay() {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      if (element.ended) element.currentTime = 0;
      element.play().catch(() => {});
    } else {
      element.pause();
    }
  }

  function handleSeek(_e, value) {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = value;
    // shown at once: the frame of the video follows when decoded
    setTimeS(value);
  }

  // The camera follows the slider at once, without waiting for a render.
  function handlePullBackChange(_e, value) {
    setPullBackDraftM(value);
    const pose = isVideoMode
      ? getCameraPathPoseAtTime(
          samples,
          videoRef.current?.currentTime ?? timeS
        )
      : hasReconstructionPose(frame)
        ? frame.pose
        : null;
    if (pose) applyPose(pose, value);
  }

  function handlePullBackCommit(_e, value) {
    dispatch(setReconstructionPullBackM(value));
    setPullBackDraftM(null);
  }

  function handleStep(delta) {
    setFrameIndex(
      Math.min(Math.max(0, safeIndex + delta), Math.max(0, frames.length - 1))
    );
  }

  async function handleReloadVideo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await reloadReconstructionVideoService({ baseMapId: baseMap.id, file });
      dispatch(bumpReconstructionVideoVersion());
      dispatch(triggerBaseMapsUpdate());
    } catch (error) {
      console.error("[reconstruction3d] video reload failed", error);
      dispatch(
        setToaster({
          message: `Vidéo non chargée : ${error?.message ?? error}`,
          severity: "error",
        })
      );
    }
  }

  // render

  return (
    <Paper
      ref={paperRef}
      elevation={8}
      data-capture-hide
      sx={{
        position: "absolute",
        top: TOP,
        right: RIGHT_GAP + rightDrawerWidth,
        zIndex: 12,
        width: size?.width ?? POPPER_WIDTH,
        maxWidth: `calc(100% - ${2 * RIGHT_GAP}px)`,
        ...(size
          ? {
              height: size.height,
              maxHeight: isAutoHeight
                ? getPanelAutoMaxHeight({
                    top: `${TOP}px`,
                    offsetY: position.y,
                  })
                : `calc(100% - ${TOP}px)`,
            }
          : {
              maxHeight: getPanelAutoMaxHeight({
                top: `${TOP}px`,
                offsetY: position.y,
              }),
            }),
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 2,
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging.current
          ? "right 0.15s ease"
          : "transform 0.1s ease-out, right 0.15s ease",
      }}
    >
      {/* Draggable header: title + camera coupling */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 1.25,
          pr: 0.5,
          minHeight: 34,
          borderBottom: "1px solid",
          borderColor: "divider",
          cursor: "grab",
          "&:active": { cursor: "grabbing" },
          userSelect: "none",
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, fontWeight: 700 }}
        >
          {titleS}
          {!isVideoMode && frame && (
            <Box
              component="span"
              sx={{ fontWeight: 400, color: "text.secondary", ml: 1 }}
            >
              {frame.name}
              {posedCount > 0 && !hasReconstructionPose(frame)
                ? ` — ${noCameraTagS}`
                : ""}
            </Box>
          )}
        </Typography>
        {coupling && (
          <Tooltip
            title={`${pullBackS} : ${pullBackM.toFixed(1).replace(".", ",")} m`}
          >
            <Box
              onMouseDown={stop}
              sx={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                width: 84,
                px: 1,
                cursor: "default",
              }}
            >
              <Slider
                size="small"
                min={0}
                max={RECONSTRUCTION_PULL_BACK_MAX_M}
                step={0.1}
                value={pullBackM}
                aria-label={pullBackS}
                onChange={handlePullBackChange}
                onChangeCommitted={handlePullBackCommit}
              />
            </Box>
          </Tooltip>
        )}
        <Tooltip title={coupleTitle}>
          <span onMouseDown={stop}>
            <IconButton
              size="small"
              disabled={!canCouple}
              color={coupling ? "primary" : "default"}
              onClick={() => dispatch(setReconstructionCoupled(!coupled))}
            >
              {coupling ? (
                <LinkIcon sx={{ fontSize: 18 }} />
              ) : (
                <LinkOffIcon sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* The video is local to the device: offered again when missing */}
      {isVideoMissing && (
        <Box
          sx={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 1.25,
            py: 0.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {missingVideoS}
          </Typography>
          <Button
            size="small"
            startIcon={<UploadFileOutlined sx={{ fontSize: 16 }} />}
            onClick={() => reloadInputRef.current?.click()}
          >
            {reloadVideoS}
          </Button>
          <input
            ref={reloadInputRef}
            type="file"
            accept="video/*,.mov,.mp4,.m4v,.webm"
            hidden
            onChange={handleReloadVideo}
          />
        </Box>
      )}

      {/* Video / image */}
      <Box
        sx={{
          flex: 1,
          minHeight: 120,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "common.black",
          overflow: "hidden",
        }}
      >
        {isVideoMode ? (
          <Box
            component="video"
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            onClick={handleTogglePlay}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(e) => {
              if (Number.isFinite(e.currentTarget.duration))
                setDurationS(e.currentTarget.duration);
            }}
            sx={{
              display: "block",
              width: "100%",
              height: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              cursor: "pointer",
            }}
          />
        ) : frameUrl ? (
          <Box
            component="img"
            src={frameUrl}
            alt={frame?.name}
            draggable={false}
            sx={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        ) : (
          <Typography variant="caption" sx={{ color: "grey.400", p: 3 }}>
            {frame ? "…" : noImageS}
          </Typography>
        )}
      </Box>

      {/* Transport: progress bar of the video, or index of the image */}
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 0.5,
          pr: 1.5,
          minHeight: 36,
        }}
      >
        {isVideoMode ? (
          <>
            <IconButton
              size="small"
              title={playing ? pauseS : playS}
              onClick={handleTogglePlay}
            >
              {playing ? (
                <PauseIcon sx={{ fontSize: 20 }} />
              ) : (
                <PlayArrowIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
            <Slider
              size="small"
              min={0}
              max={durationS || 1}
              step={0.01}
              value={Math.min(timeS, durationS || 1)}
              onChange={handleSeek}
              sx={{ flex: 1 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
            >
              {formatTime(timeS)} / {formatTime(durationS)}
            </Typography>
          </>
        ) : (
          <>
            <IconButton
              size="small"
              title={prevS}
              disabled={safeIndex <= 0}
              onClick={() => handleStep(-1)}
            >
              <ChevronLeftIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton
              size="small"
              title={nextS}
              disabled={safeIndex >= frames.length - 1}
              onClick={() => handleStep(1)}
            >
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Slider
              size="small"
              min={0}
              max={Math.max(1, frames.length - 1)}
              step={1}
              disabled={frames.length < 2}
              value={safeIndex}
              onChange={(_e, value) => setFrameIndex(value)}
              sx={{ flex: 1 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
            >
              {frames.length ? safeIndex + 1 : 0} / {frames.length}
              {Number.isFinite(frame?.timeS)
                ? ` — ${formatTime(frame.timeS)}`
                : ""}
            </Typography>
          </>
        )}
      </Box>

      <PanelFooter
        resizeCorner="bottom-left"
        onResizeMouseDown={handleResizeMouseDown}
        onResetSize={resetSize}
        onFitContent={fitContent}
        isAutoHeight={isAutoHeight}
      />
    </Paper>
  );
}
