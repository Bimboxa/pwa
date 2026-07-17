import { CanvasTexture, RepeatWrapping } from "three";

// Procedural watercolor-paper texture (no external asset): cream base +
// per-pixel gaussian-ish noise + a few short semi-transparent fiber strokes.
// Multiplied over the final frame by SketchShader, so values stay near white.
const SIZE = 512;
const BASE_COLOR = "#f4f1ea";
// ± around the base, in 0..255 channel units. Kept subtle: the paper is
// multiplied over the whole frame, a strong per-pixel noise here reads as
// pointillism on the color washes.
const NOISE_AMPLITUDE = 4;
const FIBER_COUNT = 300;

export default function createPaperTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BASE_COLOR;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle grain: sum of two randoms ≈ triangular (gaussian-like) noise.
  const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() + Math.random() - 1) * NOISE_AMPLITUDE;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
  ctx.putImageData(imageData, 0, 0);

  // Paper fibers: short, faint, randomly oriented strokes.
  for (let i = 0; i < FIBER_COUNT; i++) {
    const x = Math.random() * SIZE;
    const y = Math.random() * SIZE;
    const angle = Math.random() * Math.PI;
    const length = 4 + Math.random() * 10;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const darker = Math.random() < 0.5;
    const alpha = 0.03 + Math.random() * 0.05;
    ctx.strokeStyle = darker
      ? `rgba(120, 110, 95, ${alpha})`
      : `rgba(255, 255, 252, ${alpha})`;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x - dx / 2, y - dy / 2);
    ctx.lineTo(x + dx / 2, y + dy / 2);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}
