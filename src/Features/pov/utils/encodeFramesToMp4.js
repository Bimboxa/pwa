import { Muxer, ArrayBufferTarget } from "mp4-muxer";

// H.264 profiles tried in order (High 4.0 → Main 4.0 → Baseline 3.0). The
// browser picks the first one it can hardware-encode at the requested size.
const CODEC_CANDIDATES = ["avc1.640028", "avc1.4D0028", "avc1.42E01E"];

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

  let codec = null;
  for (const candidate of CODEC_CANDIDATES) {
    try {
      const { supported } = await window.VideoEncoder.isConfigSupported({
        ...baseConfig,
        codec: candidate,
      });
      if (supported) {
        codec = candidate;
        break;
      }
    } catch {
      // unsupported config strings throw instead of returning supported:false
    }
  }
  if (!codec) throw new Error("NO_AVC_CODEC");

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
  encoder.configure({ ...baseConfig, codec });

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
