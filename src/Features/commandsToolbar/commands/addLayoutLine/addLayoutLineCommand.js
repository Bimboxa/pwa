import ViewWeek from "@mui/icons-material/ViewWeek";

import createPolygonLineCommand from "../../utils/createPolygonLineCommand";

// « Ajouter une ligne de calepinage » (ADD_LAYOUT_LINE drawing mode) on the
// selected POLYGON — only when its template has the Calepinage feature on
// (template.hasLayoutLines, read from ctx.selectedAnnotation.annotationTemplate).
export default createPolygonLineCommand({
  key: "ADD_LAYOUT_LINE",
  label: "Ajouter une ligne de calepinage",
  Icon: ViewWeek,
  drawingMode: "ADD_LAYOUT_LINE",
  types: ["POLYGON"],
  typesReason: "Réservé aux surfaces",
  extraCheck: (ctx) =>
    ctx.selectedAnnotation?.annotationTemplate?.hasLayoutLines
      ? null
      : {
          enabled: false,
          reason: "Le modèle de l'annotation n'a pas de calepinage",
        },
});
