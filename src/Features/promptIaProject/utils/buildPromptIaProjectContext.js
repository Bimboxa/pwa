import {
  BASE_MAP_LISTING_KINDS,
  BUSINESS_OBJECT_LISTING_TYPES,
  PROJECT_ANNOTATION_TYPES,
} from "./parsePromptIaProjectOutput.js";

/**
 * `contexte.json` of a Prompt IA zip — project creation (dashboard) or Krto
 * creation (configuration "Prompt IA", `scope` given: the project already
 * exists and the answer holds exactly one scope).
 *
 * Pure: relative imports only, so it runs under `node --test`.
 *
 * @param {Object} params
 * @param {{name?: string, clientRef?: string}} params.project
 * @param {string} params.description - scopes to create, in the user's words
 * @param {Array} params.files - described input files (describePromptIaEntries)
 * @param {{name: string} | null} [params.scope] - Krto under creation
 */
export default function buildPromptIaProjectContext({
  project,
  description,
  files,
  scope = null,
}) {
  return {
    app: "Krto",
    kind: scope ? "SCOPE" : "PROJECT",
    generatedAt: new Date().toISOString(),
    project: {
      name: project?.name?.trim() || null,
      clientRef: project?.clientRef?.trim() || null,
    },
    ...(scope && { scope: { name: scope.name?.trim() || null } }),
    scopesDescription: description?.trim() ?? "",
    files,
    output: {
      zipEntries: [
        "projet.json",
        "pdfs/<nom>.pdf",
        "satellite/site.png",
        "documents/<nom>.pdf",
      ],
      rootKeys: [
        "version",
        "coordinateSpace",
        "project",
        "site",
        "baseMaps",
        "documents",
        "scopes",
        "note",
      ],
      scopeKeys: ["id", "name", "listings", "businessObjectListings", "issues"],
      ...(scope && { scopesCount: 1 }),
      businessObjectListingTypes: BUSINESS_OBJECT_LISTING_TYPES,
      qtyGapThreshold: 0.05,
      coordinateSpaces: ["image", "pdf_user_space"],
      baseMapListings: BASE_MAP_LISTING_KINDS,
      annotationTypes: PROJECT_ANNOTATION_TYPES,
    },
  };
}
