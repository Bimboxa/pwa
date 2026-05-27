// Bottom-right corner with a comfortable margin from the viewport edges.
export default function getDefaultChronoPosition(panelWidth) {
  const margin = 24;
  const safeBottomBar = 56;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return {
    x: Math.max(margin, vw - panelWidth - margin),
    y: Math.max(margin, vh - safeBottomBar - 200),
  };
}
