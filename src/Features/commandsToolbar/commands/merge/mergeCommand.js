import { CallMerge } from "@mui/icons-material";

import ButtonMerge from "./ButtonMerge";
import {
  getMergeTarget,
  MERGE_UNAVAILABLE,
  resolveMergeTarget,
} from "./resolveMergeSelection";
import { getSelectionGate } from "../../utils/selectionCommandState";

export { getMergeTarget };

const UNAVAILABLE_REASONS = {
  [MERGE_UNAVAILABLE.TOO_FEW]: "Sélectionnez au moins deux annotations",
  [MERGE_UNAVAILABLE.MIXED_BASE_MAPS]:
    "Les annotations doivent être sur le même fond de plan",
  [MERGE_UNAVAILABLE.MIXED_TEMPLATES]:
    "Les annotations sélectionnées doivent partager un même modèle (ou n'en avoir aucun)",
  [MERGE_UNAVAILABLE.MESH_IN_2D]:
    "Fusion en maille disponible dans l'éditeur 3D",
  [MERGE_UNAVAILABLE.NOT_MERGEABLE]:
    "Sélectionnez des lignes ou des surfaces (sans révolution, profil ni ouverture)",
};

// « Fusionner les annotations »: merges the selected annotations into one.
// Hybrid (resolveMergeSelection): the parametric 2D merge when the selection
// is lines only or surfaces only with the same 3D attributes
// (useMergeAnnotations), else — in the 3D editor — the mesh merge: the seed
// becomes / updates its isMesh3d mesh and absorbs the others
// (mergeAnnotationsToMeshService). Same template or no template at all; a
// template-less shape absorbed by a templated one takes its template.
export default {
  key: "MERGE",
  label: "Fusionner les annotations",
  Icon: CallMerge,
  Button: ButtonMerge,
  getState(ctx) {
    const gate = getSelectionGate(ctx, { min: 2 });
    if (gate) return gate;
    const target = resolveMergeTarget(ctx);
    if (!target.mode) {
      return {
        enabled: false,
        reason:
          UNAVAILABLE_REASONS[target.unavailable] ??
          UNAVAILABLE_REASONS[MERGE_UNAVAILABLE.NOT_MERGEABLE],
      };
    }
    return { enabled: true };
  },
};
