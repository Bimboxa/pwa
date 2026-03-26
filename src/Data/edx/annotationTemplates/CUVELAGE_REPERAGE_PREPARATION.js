import theme from "Styles/theme";

const secondary = theme.palette.secondary.main;

const CUVELAGE_REPERAGE_PREPARATION = {
  key: "CUVELAGE_REPERAGE_PREPARATION",
  name: "Cuvelage - Préparation repérage",
  iconKey: "shapes",
  color: secondary,
  keywords: ["type:repérage", "secteur:cuvelage"],
  templates: [
    {
      label: "Poteaux",
      drawingShape: "POLYLINE",
      group: "Mur",
      strokeColor: "#FF6D00",
      strokeWidth: 4,
      strokeWidthUnit: "PX",
      defaultTool: "POLYLINE_RECTANGLE",
      overrideFields: ["strokeColor", "strokeWidth", "strokeWidthUnit"],
    },
    {
      label: "Mur CT",
      drawingShape: "POLYLINE",
      group: "Mur",
      strokeColor: "#00B0FF",
      strokeOpacity: 0.8,
      strokeWidth: 6,
      strokeWidthUnit: "CM",
      mainQtyKey: "L",
      overrideFields: ["strokeColor", "strokeWidth", "strokeWidthUnit"],
    },
    {
      label: "Murs intérieurs",
      drawingShape: "POLYLINE",
      group: "Mur",
      strokeColor: "#FFAB00",
      strokeOpacity: 0.9,
      strokeWidth: 6,
      strokeWidthUnit: "CM",
      mainQtyKey: "L",
      overrideFields: ["strokeColor", "strokeWidth", "strokeWidthUnit"],
    },
    {
      label: "Retour technique 1m",
      drawingShape: "POLYLINE",
      group: "Mur",
      strokeColor: "#AA00FF",
      strokeOpacity: 0.5,
      strokeWidth: 100,
      strokeWidthUnit: "CM",
      defaultTool: "STRIP",
      overrideFields: ["strokeColor", "strokeWidth", "strokeWidthUnit"],
    },
  ],
};

export default CUVELAGE_REPERAGE_PREPARATION;
