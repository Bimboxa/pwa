import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// H.264 profile+level candidates, best first. The LEVEL matters as much as
// the profile: the A4 frame ratio gives tall outputs (1920×1358 = 10200
// macroblocks) that blow past level 4.0's 8192 MB limit, so a 4.0-only list
// gets "unsupported" for every candidate. 5.x first, then the lower levels
// for the smaller export sizes.
const CODEC_CANDIDATES = [
  "avc1.640034", // High 5.2
  "avc1.640033", // High 5.1
  "avc1.640032", // High 5.0
  "avc1.64002a", // High 4.2
  "avc1.640028", // High 4.0
  "avc1.4d0034", // Main 5.2
  "avc1.4d0032", // Main 5.0
  "avc1.4d0028", // Main 4.0
  "avc1.420034", // Baseline 5.2
  "avc1.420032", // Baseline 5.0
  "avc1.42e01e", // Baseline 3.0
];

// ~0.13 bit per pixel ≈ 8 Mbps at 1080p30 — the usual H.264 quality point.
const BITS_PER_PIXEL = 0.15;

// Frames are queued asynchronously by the encoder: keep the queue short so a
// long generation doesn't pile up hundreds of VideoFrames in memory.
const MAX_QUEUE_SIZE = 8;

export function isMp4EncodingSupported() {
  return (
    typeof window !== "undefined" && typeof window.VideoEncoder === "function"
  );
}

/**
 * Canvas frames -> H.264 / MP4 blob, via WebCodecs + mp4-muxer.
 *
 * Deliberately NOT MediaRecorder: MediaRecorder timestamps in wall-clock time,
 * so any frame slower than 1/fps to render would come out as slow motion. Here
 * the timestamps come from the frame index, so the generator can take as long
 * as it needs per frame (and pause between segments while the scene settles).
 *
 * @returns {Promise<{addFrame:(canvas:HTMLCanvasElement,index:number)=>Promise<void>, finish:()=>Promise<Blob>, close:()=>void}>}
 */
export default async function createMp4Encoder({ width, height, fps }) {
  if (!isMp4EncodingSupported()) throw new Error("WEBCODECS_UNAVAILABLE");

  const baseConfig = {
    width,
    height,
    framerate: fps,
    bitrate: Math.round(width * height * fps * BITS_PER_PIXEL),
    latencyMode: "quality",
    avc: { format: "avc" },
  };

  // Two probe rounds: the full config, then a minimal one — an unsupported
  // optional field (latencyMode, avc.format) makes isConfigSupported throw a
  // TypeError for EVERY candidate, which would look like "no codec at all".
  const minimalConfig = {
    width,
    height,
    bitrate: baseConfig.bitrate,
  };

  let codec = null;
  let config = null;
  for (const probeConfig of [baseConfig, minimalConfig]) {
    for (const candidate of CODEC_CANDIDATES) {
      try {
        const { supported } = await window.VideoEncoder.isConfigSupported({
          ...probeConfig,
          codec: candidate,
        });
        if (supported) {
          codec = candidate;
          config = { ...probeConfig, codec: candidate };
          break;
        }
      } catch {
        // invalid codec strings / configs throw instead of returning false
      }
    }
    if (codec) break;
  }
  if (!codec) {
    throw new Error(
      `NO_AVC_CODEC (${width}x${height} @ ${fps}fps) — no H.264 profile/level supported by this browser`
    );
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: fps },
    fastStart: "in-memory",
  });

  let encodeError = null;
  const encoder = new window.VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encodeError = error;
    },
  });
  encoder.configure(config);

  const frameDurationUs = Math.round(1e6 / fps);
  const keyFrameInterval = Math.max(1, fps * 2); // keyframe every 2 s

  async function addFrame(canvas, index) {
    if (encodeError) throw encodeError;

    const frame = new window.VideoFrame(canvas, {
      timestamp: Math.round((index * 1e6) / fps),
      duration: frameDurationUs,
    });
    try {
      encoder.encode(frame, { keyFrame: index % keyFrameInterval === 0 });
    } finally {
      frame.close();
    }

    while (encoder.encodeQueueSize > MAX_QUEUE_SIZE && !encodeError) {
      await new Promise((resolve) => setTimeout(resolve, 4));
    }
  }

  async function finish() {
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: "video/mp4" });
  }

  function close() {
    try {
      if (encoder.state !== "closed") encoder.close();
    } catch {
      // already closed
    }
  }

  return { addFrame, finish, close, codec };
}
