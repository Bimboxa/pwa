/**
 * Module-level mutable ref holding the current segment length (in pixels)
 * for the active drawing viewer.
 *
 * Why a module-level singleton rather than a `useRef` inside
 * DrawingMetricsContext? The value is updated on every mouse move
 * (potentially ~60 Hz) while the in-progress segment follows the cursor.
 * Putting it in Redux would dispatch on every frame; putting it in React
 * state would re-render. A ref is the right shape — and a module-level
 * one is accessible from components outside the DrawingMetricsProvider
 * (the bottom bar, in particular), which the provider's `useRef` is not.
 *
 * Writer: `InteractionLayer` (active viewer only — gated by isActiveViewer
 * on the consuming key/mouse handlers).
 * Reader: `SegmentLengthBottomBar` polls it via requestAnimationFrame.
 */
const segmentLengthPxRef = { current: 0 };

export default segmentLengthPxRef;
