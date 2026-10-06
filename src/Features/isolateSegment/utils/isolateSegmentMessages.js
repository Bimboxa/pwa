import { ISOLATE_SEGMENT_REASONS } from "../services/isolateSegmentService";

// French toasters of the « Isoler un segment / une face » commands.
export const ISOLATE_SEGMENT_DONE_MESSAGE = "Segment isolé";

export const ISOLATE_SEGMENT_READ_ONLY_MESSAGE =
  "Segment non isolé : cette annotation est en lecture seule.";

export const ISOLATE_SEGMENT_REFUSED_MESSAGES = {
  [ISOLATE_SEGMENT_REASONS.TYPE]:
    "Cet outil ne s'applique qu'aux polylignes et aux bandes",
  [ISOLATE_SEGMENT_REASONS.MESH3D]:
    "Une annotation maillée ne peut pas être isolée par segment",
  [ISOLATE_SEGMENT_REASONS.SUBTRACTION]:
    "Segment non isolé : cette annotation participe à une soustraction",
  [ISOLATE_SEGMENT_REASONS.NOT_FOUND]: "Segment introuvable",
  [ISOLATE_SEGMENT_REASONS.ALREADY_ISOLATED]:
    "Ce segment est déjà isolé (polyligne à un seul segment)",
  [ISOLATE_SEGMENT_REASONS.FAILED]: "Le segment n'a pas pu être isolé",
};

export function getIsolateSegmentRefusedMessage(reason) {
  return (
    ISOLATE_SEGMENT_REFUSED_MESSAGES[reason] ??
    ISOLATE_SEGMENT_REFUSED_MESSAGES[ISOLATE_SEGMENT_REASONS.FAILED]
  );
}
