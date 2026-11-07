// Analogous purple, blue and pink hues based on the secondary color #423188.
const palette = [
  { label: "violet", main: "#423188", light: "#B2A6DF" },
  { label: "bleu", main: "#314788", light: "#A6B5DF" },
  { label: "rose", main: "#883177", light: "#DFA6D4" },
];

const DEFAULT = {
  key: "DEFAULT",
  name: "Générique",
  iconKey: "shapes",
  color: palette[0].main,
  keywords: ["type:repérage"],
  templates: [
    ...palette.map(({ label, main, light }) => ({
      drawingShape: "POLYGON",
      label: `Surface — ${label}`,
      labelLegend: `Surface — ${label}`,
      group: "Surfaces",
      groupLabel: "Surfaces",
      fillColor: light,
      fillType: "SOLID",
      fillOpacity: 0.75,
      strokeColor: main,
      closeLine: true,
      mainQtyKey: "S",
      overrideFields: ["fillColor", "strokeColor"],
    })),
    ...palette.map(({ label, main }) => ({
      drawingShape: "POLYLINE",
      label: `Ligne — ${label}`,
      labelLegend: `Ligne — ${label}`,
      group: "Lignes",
      groupLabel: "Lignes",
      strokeColor: main,
      strokeOpacity: 1,
      strokeWidth: 3,
      strokeWidthUnit: "PX",
      closeLine: false,
      mainQtyKey: "L",
      overrideFields: ["strokeColor"],
    })),
    ...palette.map(({ label, main }) => ({
      drawingShape: "POINT",
      variant: "CIRCLE",
      label: `Point — ${label}`,
      labelLegend: `Point — ${label}`,
      group: "Points",
      groupLabel: "Points",
      fillColor: main,
      size: 8,
      sizeUnit: "PX",
      mainQtyKey: "U",
      overrideFields: ["fillColor"],
    })),
  ],
};

export default DEFAULT;
