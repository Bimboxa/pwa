import IconSplitInSegments from "Features/icons/IconSplitInSegments";

import ButtonSplitInSegments from "./ButtonSplitInSegments";
import { getTargetsState } from "../../utils/selectionCommandState";

export const SPLIT_IN_SEGMENTS_TYPES = ["POLYLINE", "POLYGON", "STRIP"];

// « Découper en segments »: replaces the selected lines / surfaces / bands by
// isolated segments (same template, or a chosen polyline template —
// useSplitAnnotationsInSegments), then deletes the sources.
export default {
  key: "SPLIT_IN_SEGMENTS",
  label: "Découper en segments",
  Icon: IconSplitInSegments,
  Button: ButtonSplitInSegments,
  getState: (ctx) =>
    getTargetsState(
      ctx,
      SPLIT_IN_SEGMENTS_TYPES,
      "Sélectionnez au moins une ligne, surface ou bande"
    ),
};
