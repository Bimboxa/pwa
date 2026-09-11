import PLAN_DE_NIVEAU from "./PLAN_DE_NIVEAU";

const ASBESTOS_BASE_MAP_DRAWING = {
  key: "ASBESTOS_BASE_MAP_DRAWING",
  name: "Dessin fonds de plan",
  iconKey: "shapes",
  color: PLAN_DE_NIVEAU.color,
  keywords: ["type:repérage"],
  templates: PLAN_DE_NIVEAU.templates
    .filter((template) => template.label !== "Poteau")
    .map((template) => ({
      ...template,
      label: template.label === "Mur béton" ? "Mur" : template.label,
    })),
};

export default ASBESTOS_BASE_MAP_DRAWING;
