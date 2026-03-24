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
      label: "Parement voile CT, ép. 5cm",
      drawingShape: "POLYLINE",
      strokeColor: secondary,
      strokeOpacity: 0.8,
      strokeWidth: 5,
      strokeWidthUnit: "CM",
      mainQtyKey: "L",
    },
    {
      label: "Remplissage mur intérieur",
      drawingShape: "POLYGON",
      fillColor: secondary,
      fillOpacity: 0.5,
      defaultTool: "SURFACE_DROP",
    },
    {
      label: "Mur intérieur 20cm",
      drawingShape: "POLYLINE",
      strokeColor: secondary,
      strokeOpacity: 0.5,
      strokeWidth: 20,
      strokeWidthUnit: "CM",
      defaultTool: "STRIP",
      mainQtyKey: "L",
    },
    {
      label: "Mur intérieur xx cm",
      drawingShape: "POLYLINE",
      strokeColor: secondary,
      strokeOpacity: 0.5,
      strokeWidth: 10,
      strokeWidthUnit: "CM",
      defaultTool: "STRIP",
      mainQtyKey: "L",
    },
    {
      label: "Parement voile intérieur",
      drawingShape: "POLYLINE",
      strokeColor: secondary,
      strokeOpacity: 0.8,
      strokeWidth: 4,
      strokeWidthUnit: "PX",
      mainQtyKey: "L",
    },
    {
      label: "Poteaux rectangulaire",
      drawingShape: "POLYLINE",
      strokeColor: secondary,
      strokeOpacity: 0.5,
      strokeWidth: 4,
      strokeWidthUnit: "PX",
      defaultTool: "POLYLINE_RECTANGLE",
    },
    {
      label: "Surface",
      drawingShape: "POLYGON",
      fillColor: secondary,
      fillOpacity: 0.5,
      fillType: "HATCHING",
    },
    {
      label: "Voiles contre rampe",
      drawingShape: "POLYLINE",
      strokeColor: secondary,
      strokeOpacity: 0.8,
      strokeWidth: 4,
      strokeWidthUnit: "PX",
      mainQtyKey: "L",
    },
  ],
};

export default CUVELAGE_REPERAGE_PREPARATION;
