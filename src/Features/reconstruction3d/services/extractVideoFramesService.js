import {
  RECONSTRUCTION_FRAME_JPEG_QUALITY,
  RECONSTRUCTION_FRAME_MAX_PX,
  RECONSTRUCTION_MAX_FRAMES,
  RECONSTRUCTION_MIN_FRAME_INTERVAL_S,
} from "../constants/reconstruction3dTool";

// Samples a video file into timestamped JPEG frames, in the browser: a
// detached <video> is seeked from frame to frame and drawn on a canvas. The
// AI chat receives these frames (never the video itself: far too heavy, and
// the times of the frames would be the model's guess) and returns one camera
// per frame — the time ↔ camera series of the reconstruction.

const SEEK_TIMEOUT_MS = 15000;
// Seeking exactly at the end of a video may never resolve.
const END_MARGIN_S = 0.05;

function makeError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function waitForEvent(video, eventName, timeoutMs = SEEK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let timer = null;
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(eventName, onEvent);
      video.removeEventListener("error", onError);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(
        makeError(
          "VIDEO_UNREADABLE",
          "Ce navigateur ne sait pas lire cette vidéo. Convertissez-la en MP4 (H.264) et réessayez."
        )
      );
    };
    timer = setTimeout(() => {
      cleanup();
      reject(
        makeError("VIDEO_TIMEOUT", "La lecture de la vidéo n'aboutit pas.")
      );
    }, timeoutMs);
    video.addEventListener(eventName, onEvent, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(makeError("FRAME_ENCODE", "Image non encodée.")),
      "image/jpeg",
      quality
    );
  });
}

// Sampling step of a video: `minIntervalS`, stretched so that the whole
// duration gives at most `maxFrames` frames.
export function getVideoFrameIntervalS(
  durationS,
  {
    minIntervalS = RECONSTRUCTION_MIN_FRAME_INTERVAL_S,
    maxFrames = RECONSTRUCTION_MAX_FRAMES,
  } = {}
) {
  if (!(durationS > 0)) return minIntervalS;
  return Math.max(minIntervalS, durationS / Math.max(1, maxFrames));
}

// Times of the sampled frames, seconds: 0, step, 2·step… up to the duration.
export function getVideoFrameTimes(durationS, intervalS) {
  if (!(durationS > 0) || !(intervalS > 0)) return [0];
  const lastTime = Math.max(0, durationS - END_MARGIN_S);
  const times = [];
  for (let i = 0; i * intervalS <= lastTime + 1e-6; i++) {
    times.push(Math.min(i * intervalS, lastTime));
  }
  return times;
}

/**
 * @param {Object} params
 * @param {File} params.file - the video
 * @param {number} [params.intervalS] - sampling step; default: see
 *   getVideoFrameIntervalS
 * @param {(ratio: number) => void} [params.onProgress]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{durationS: number, width: number, height: number,
 *   intervalS: number, frames: Array<{timeS: number, file: File,
 *   imageSize: {width: number, height: number}}>}>} width / height: of the
 *   video. Throws `error.code`: VIDEO_UNREADABLE | VIDEO_TIMEOUT |
 *   VIDEO_ABORTED | FRAME_ENCODE.
 */
export default async function extractVideoFramesService({
  file,
  intervalS = null,
  maxPx = RECONSTRUCTION_FRAME_MAX_PX,
  quality = RECONSTRUCTION_FRAME_JPEG_QUALITY,
  onProgress,
  signal,
}) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    const loaded = waitForEvent(video, "loadeddata");
    video.src = url;
    await loaded;

    const durationS = video.duration;
    const { videoWidth, videoHeight } = video;
    if (!Number.isFinite(durationS) || !(videoWidth > 0 && videoHeight > 0)) {
      throw makeError(
        "VIDEO_UNREADABLE",
        "Ce navigateur ne sait pas lire cette vidéo. Convertissez-la en MP4 (H.264) et réessayez."
      );
    }

    const step = intervalS > 0 ? intervalS : getVideoFrameIntervalS(durationS);
    const times = getVideoFrameTimes(durationS, step);
    const scale = Math.min(1, maxPx / Math.max(videoWidth, videoHeight));
    const width = Math.max(1, Math.round(videoWidth * scale));
    const height = Math.max(1, Math.round(videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    const frames = [];
    for (let i = 0; i < times.length; i++) {
      if (signal?.aborted)
        throw makeError("VIDEO_ABORTED", "Extraction annulée.");
      const timeS = times[i];
      // a seek to the current time fires no `seeked`
      if (Math.abs(video.currentTime - timeS) > 1e-4) {
        const seeked = waitForEvent(video, "seeked");
        video.currentTime = timeS;
        await seeked;
      }
      context.drawImage(video, 0, 0, width, height);
      const blob = await canvasToJpeg(canvas, quality);
      frames.push({
        timeS,
        file: new File([blob], `frame_${String(i + 1).padStart(3, "0")}.jpg`, {
          type: "image/jpeg",
        }),
        imageSize: { width, height },
      });
      onProgress?.((i + 1) / times.length);
    }

    return {
      durationS,
      width: videoWidth,
      height: videoHeight,
      intervalS: step,
      frames,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
