// Pure helpers for the text pasted back from an external AI chat (Prompt IA).

const IMAGE_SPACE = "image";
const PDF_SPACE = "pdf_user_space";
export const COORDINATE_SPACES = [IMAGE_SPACE, PDF_SPACE];

/**
 * Finds the JSON object in a pasted answer: strips markdown code fences and
 * any prose around the first balanced `{ … }` (models often add a summary).
 *
 * @returns {{ok: true, json: Object} | {ok: false, error: string|null}}
 */
export function extractJsonText(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: null };
  let body = text.trim();
  // ```json … ``` (or ``` … ```), possibly with text before/after the block
  const fence = body.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();
  const start = body.indexOf("{");
  if (start < 0) return { ok: false, error: "Aucun objet JSON trouvé dans le texte collé." };
  const end = findBalancedEnd(body, start);
  if (end < 0)
    return {
      ok: false,
      error: "JSON incomplet : l’accolade fermante manque (réponse tronquée ?).",
    };
  try {
    const json = JSON.parse(body.slice(start, end + 1));
    if (!json || typeof json !== "object" || Array.isArray(json))
      return { ok: false, error: "Le JSON doit être un objet." };
    return { ok: true, json };
  } catch (e) {
    return { ok: false, error: `JSON invalide : ${e.message}` };
  }
}

// Index of the brace closing the object opened at `start`, string-aware.
function findBalancedEnd(s, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Prepares the model's JSON for the inline import:
 * - reads and strips the root `coordinateSpace` / `note` keys;
 * - keeps the ids of templates that exist in the project (the import then
 *   reuses those rows: `preserveIds`), and gives every other template a fresh
 *   id so an author id like "tpl_mur" never reaches the database;
 * - drops import-time metadata that is not a template row field;
 * - same id rule for the detail baseMaps of `baseMaps`: an entry whose id is
 *   an existing detail baseMap is dropped (nothing to create, the bubbles
 *   link the existing one), every other entry gets a fresh id, and the
 *   `detailBaseMapId` of the DETAIL annotations follows.
 *
 * @param {Object} json
 * @param {{existingTemplateIds: Iterable<string>,
 *   existingBaseMapIds?: Iterable<string>, newId: () => string}} opts
 * @returns {{payload: Object, coordinateSpace: string, note: string|null,
 *   reusedTemplateIds: string[], reusedBaseMapIds: string[], error?: string}}
 */
export function normalizePromptIaPayload(
  json,
  { existingTemplateIds, existingBaseMapIds, newId }
) {
  const { coordinateSpace: rawSpace, note, ...rest } = json;
  const coordinateSpace = rawSpace ?? IMAGE_SPACE;
  if (!COORDINATE_SPACES.includes(coordinateSpace)) {
    return {
      payload: null,
      coordinateSpace,
      note: null,
      reusedTemplateIds: [],
      reusedBaseMapIds: [],
      error: `coordinateSpace inconnu : ${coordinateSpace} (attendu ${COORDINATE_SPACES.join(" ou ")}).`,
    };
  }
  const existing = new Set(existingTemplateIds ?? []);
  const idMap = new Map();
  const reusedTemplateIds = [];
  const annotationTemplates = Array.isArray(rest.annotationTemplates)
    ? rest.annotationTemplates.map((t) => {
        if (!t || typeof t !== "object" || !t.id) return t;
        const { incomplete, ...row } = t;
        void incomplete;
        if (existing.has(t.id)) {
          reusedTemplateIds.push(t.id);
          return row;
        }
        const id = idMap.get(t.id) ?? newId();
        idMap.set(t.id, id);
        return { ...row, id };
      })
    : rest.annotationTemplates;
  // Detail baseMaps: existing ids are reused, author ids are reminted.
  const existingBaseMaps = new Set(existingBaseMapIds ?? []);
  const baseMapIdMap = new Map();
  const reusedBaseMapIds = [];
  const baseMaps = Array.isArray(rest.baseMaps)
    ? rest.baseMaps.flatMap((bm) => {
        if (!bm || typeof bm !== "object" || typeof bm.id !== "string")
          return [bm];
        if (existingBaseMaps.has(bm.id)) {
          reusedBaseMapIds.push(bm.id);
          return [];
        }
        // A duplicate author id keeps its own entry: the import validator
        // reports it.
        if (baseMapIdMap.has(bm.id)) return [bm];
        const id = newId();
        baseMapIdMap.set(bm.id, id);
        return [{ ...bm, id }];
      })
    : rest.baseMaps;

  let unknownBaseMapId = null;
  const annotations = Array.isArray(rest.annotations)
    ? rest.annotations.map((a) => {
        if (!a || typeof a !== "object") return a;
        let next = a;
        if (idMap.has(a.annotationTemplateId))
          next = {
            ...next,
            annotationTemplateId: idMap.get(a.annotationTemplateId),
          };
        const target = a.detailBaseMapId;
        if (typeof target === "string" && target) {
          if (baseMapIdMap.has(target))
            next = { ...next, detailBaseMapId: baseMapIdMap.get(target) };
          else if (!existingBaseMaps.has(target))
            unknownBaseMapId = unknownBaseMapId ?? target;
        }
        return next;
      })
    : rest.annotations;
  if (unknownBaseMapId) {
    return {
      payload: null,
      coordinateSpace,
      note: null,
      reusedTemplateIds,
      reusedBaseMapIds,
      error: `detailBaseMapId inconnu : ${unknownBaseMapId} (attendu un id de \`baseMaps\` ou d’un fond de détail existant).`,
    };
  }
  return {
    payload: {
      version: rest.version ?? "1.0",
      ...rest,
      annotationTemplates,
      annotations,
      ...(baseMaps !== undefined ? { baseMaps } : {}),
    },
    coordinateSpace,
    note: typeof note === "string" && note.trim() ? note.trim() : null,
    reusedTemplateIds,
    reusedBaseMapIds,
  };
}
