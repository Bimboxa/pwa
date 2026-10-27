import { alpha } from "@mui/material/styles";

// Dimming of the diagram zones outside the highlighted set.
export const ZONE_DIM_OPACITY = 0.25;

// Zone emphasis of the starting diagrams. `highlightedZones` is a Set of
// data-zone ids, or null when nothing is highlighted (every zone at full
// opacity). Returns zoneProps(zoneId) → props of the <g> of that zone:
// opacity + soft accent glow, and data-highlighted driving the accent
// stroke of its [data-accent-stroke] children (see DiagramZone).
export default function makeZoneProps(highlightedZones, theme) {
  const baseStyle = { transition: "opacity .2s, filter .2s" };
  const glow = `drop-shadow(0 0 3px ${alpha(theme.palette.secondary.main, 0.55)})`;

  return function zoneProps(zoneId) {
    if (!highlightedZones) return { style: baseStyle };
    const on = highlightedZones.has(zoneId);
    return {
      "data-highlighted": on ? "true" : undefined,
      style: {
        ...baseStyle,
        opacity: on ? 1 : ZONE_DIM_OPACITY,
        filter: on ? glow : "none",
      },
    };
  };
}
