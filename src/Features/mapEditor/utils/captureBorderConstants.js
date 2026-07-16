// Rounded border drawn inside the capture rect when imageModeBorder is on.
// Shared between the on-screen overlay (ImageModeOverlay) and the capture
// masking (captureMapAsPng) so what you see is exactly what gets exported.
// Values are in screen px (scaled by pixelRatio at capture time).
// The title banner shares the same radius and origin so it hugs the border.
export const CAPTURE_BORDER_INSET = 6;
export const CAPTURE_BORDER_RADIUS = 8;
export const CAPTURE_BORDER_STROKE_WIDTH = 1.5;
