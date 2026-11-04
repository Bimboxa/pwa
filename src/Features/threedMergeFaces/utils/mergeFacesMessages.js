import { MERGE_MESH3D_REASONS } from "./mergeMesh3dSolids.js";

// French toasters of the « Fusionner des faces » command and of the mesh
// mode of « Fusionner les annotations » (mergeAnnotationsToMeshService).
export const MERGE_FACES_REASONS = {
  ...MERGE_MESH3D_REASONS,
  NOT_FOUND: "NOT_FOUND",
  MIXED_TEMPLATES: "MIXED_TEMPLATES",
  TOO_FEW: "TOO_FEW",
  SAME_ANNOTATION: "SAME_ANNOTATION",
  NOT_COPLANAR: "NOT_COPLANAR",
  DIFFERENT_BASE_MAP: "DIFFERENT_BASE_MAP",
  DIFFERENT_TYPE: "DIFFERENT_TYPE",
  HAS_RELATIONS: "HAS_RELATIONS",
  NOT_EDITABLE: "NOT_EDITABLE",
  NO_FACE: "NO_FACE",
  FAILED: "FAILED",
};

export const MERGE_FACES_DONE_MESSAGE =
  "Faces fusionnées (Ctrl+Z pour annuler)";
export const MERGE_FACES_SEED_MESSAGE =
  "Face de départ choisie : cliquez une face coplanaire d'une autre annotation";
export const MERGE_FACES_READ_ONLY_MESSAGE =
  "Fusion impossible : cette annotation est en lecture seule.";
export const MERGE_ANNOTATIONS_DONE_MESSAGE =
  "Annotations fusionnées (Ctrl+Z pour annuler)";

export const MERGE_FACES_REFUSED_MESSAGES = {
  [MERGE_FACES_REASONS.NO_FACE]: "Cliquez une face d'une annotation",
  [MERGE_FACES_REASONS.SAME_ANNOTATION]:
    "Cliquez une face d'une autre annotation",
  [MERGE_FACES_REASONS.NOT_COPLANAR]:
    "Cette face n'est pas coplanaire avec la face de départ",
  [MERGE_FACES_REASONS.NOT_TOUCHING]:
    "Les deux faces ne se touchent pas : rien à fusionner",
  [MERGE_FACES_REASONS.DIFFERENT_BASE_MAP]:
    "Les deux annotations doivent être sur le même fond de plan",
  [MERGE_FACES_REASONS.DIFFERENT_TYPE]:
    "Seules des annotations de même type (même modèle) peuvent fusionner",
  [MERGE_FACES_REASONS.MIXED_TEMPLATES]:
    "Les annotations à fusionner doivent partager un même modèle (ou n'en avoir aucun)",
  [MERGE_FACES_REASONS.TOO_FEW]: "Sélectionnez au moins deux annotations",
  [MERGE_FACES_REASONS.HAS_RELATIONS]:
    "Fusion impossible : une des annotations porte des ouvertures ou une soustraction",
  [MERGE_FACES_REASONS.NOT_EDITABLE]:
    "Fusion impossible : une des annotations n'a pas de faces éditables (mur fin, révolution, profil, coque…)",
  [MERGE_FACES_REASONS.EMPTY]: "La fusion ne laisse aucune face",
  [MERGE_FACES_REASONS.NOT_FOUND]: "Annotation introuvable",
  [MERGE_FACES_REASONS.FAILED]: "Les faces n'ont pas pu être fusionnées",
};

export function getMergeFacesRefusedMessage(reason) {
  return (
    MERGE_FACES_REFUSED_MESSAGES[reason] ??
    MERGE_FACES_REFUSED_MESSAGES[MERGE_FACES_REASONS.FAILED]
  );
}

// Wordings that differ when whole annotations (not two faces) are merged.
const MERGE_ANNOTATIONS_REFUSED_MESSAGES = {
  [MERGE_FACES_REASONS.NOT_TOUCHING]:
    "Les annotations ne se touchent pas : rien à fusionner",
  [MERGE_FACES_REASONS.FAILED]: "Les annotations n'ont pas pu être fusionnées",
};

export function getMergeAnnotationsRefusedMessage(reason) {
  return (
    MERGE_ANNOTATIONS_REFUSED_MESSAGES[reason] ??
    getMergeFacesRefusedMessage(reason)
  );
}
