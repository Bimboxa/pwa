import IconCloseEnvelope from "Features/icons/IconCloseEnvelope";

import ButtonCloseEnvelope from "./ButtonCloseEnvelope";
import { getTargetsState } from "../../utils/selectionCommandState";

export const CLOSE_ENVELOPE_TYPES = ["POLYLINE", "STRIP"];

// « Fermer l'enveloppe »: adds the closing segments between the ends of the
// selected walls (POLYLINE / STRIP — useCloseEnvelope) with a chosen polyline
// template; bands are closed on their centerline then re-derived.
export default {
  key: "CLOSE_ENVELOPE",
  label: "Fermer l'enveloppe",
  Icon: IconCloseEnvelope,
  Button: ButtonCloseEnvelope,
  getState: (ctx) =>
    getTargetsState(
      ctx,
      CLOSE_ENVELOPE_TYPES,
      "Sélectionnez au moins une ligne ou une bande"
    ),
};
