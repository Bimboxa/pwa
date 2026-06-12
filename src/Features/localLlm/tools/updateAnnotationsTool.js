import db from "App/db/db";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";
import updateAnnotationService from "Features/annotations/services/updateAnnotationService";

import resolveTemplateByLabel from "./resolveTemplateByLabel";
import skill from "./skills/updateAnnotations.skill.md?raw";

// Tool: update style / label / template of existing annotations (no geometry
// edit in v1 — points stay untouched).

const UPDATABLE_FIELDS = [
  "label",
  "fillColor",
  "fillOpacity",
  "strokeColor",
  "strokeWidth",
  "strokeOpacity",
  "hidden",
];

const updateAnnotationsTool = {
  name: "UPDATE_ANNOTATIONS",
  argsKey: "annotationsToUpdate",
  whenToUse:
    "modifier des annotations existantes : renommer, changer la couleur ou le style, masquer/afficher, changer le modèle (template) d'une ou plusieurs annotations",
  routerExamples: [
    '"Passe le mur M12 en rouge" → UPDATE_ANNOTATIONS',
    '"Change le modèle d\'annotation de Surface 2 à Surface 1" → UPDATE_ANNOTATIONS',
    '"Masque les annotations Ligne A" → UPDATE_ANNOTATIONS',
  ],
  skill,
  argsSchema: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        templateLabel: { type: "string" },
        fillColor: { type: "string" },
        fillOpacity: { type: "number" },
        strokeColor: { type: "string" },
        strokeWidth: { type: "number" },
        strokeOpacity: { type: "number" },
        hidden: { type: "boolean" },
      },
      required: ["id"],
    },
  },

  async execute(items, context) {
    const { templates, listingId, dispatch } = context;

    let updatedCount = 0;
    const errors = [];

    for (const item of items ?? []) {
      const existing = item.id ? await db.annotations.get(item.id) : null;
      if (!existing) {
        errors.push(`annotation introuvable (id: ${item.id})`);
        continue;
      }

      const updates = {};
      UPDATABLE_FIELDS.forEach((field) => {
        if (item[field] !== undefined) updates[field] = item[field];
      });

      if (item.templateLabel) {
        const template = resolveTemplateByLabel(templates, item.templateLabel, {
          preferredListingId: existing.listingId ?? listingId,
        });
        if (template) updates.annotationTemplateId = template.id;
        else errors.push(`template introuvable (${item.templateLabel})`);
      }

      if (Object.keys(updates).length === 0) continue;

      await updateAnnotationService({ id: item.id, ...updates });
      updatedCount++;
    }

    dispatch(triggerAnnotationsUpdate());

    let summary = `✓ ${updatedCount} annotation(s) modifiée(s).`;
    if (errors.length > 0) summary += ` ⚠ ${errors.join(", ")}`;
    return summary;
  },
};

export default updateAnnotationsTool;
