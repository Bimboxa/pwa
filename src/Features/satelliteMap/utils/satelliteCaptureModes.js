// Capture modes for "Ajouter une image satellite" (IGN Géoplateforme WMS).
// MERCATOR is the historical behaviour (EPSG:3857 + haversine scale).
// LAMBERT_CC requests the image in a conformal Lambert CC zone and derives
// an exact, isotropic meterByPx — see ccProjection.js for the rationale.
export const SATELLITE_CAPTURE_MODES = [
  { key: "MERCATOR", label: "Web Mercator (actuel)" },
  { key: "LAMBERT_CC", label: "Lambert CC (échelle exacte)" },
];

export const DEFAULT_SATELLITE_CAPTURE_MODE = "MERCATOR";
