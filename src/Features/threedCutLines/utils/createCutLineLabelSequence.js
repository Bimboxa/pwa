import getNextAutoNumberLabel from "../../annotations/utils/getNextAutoNumberLabel.js";

import {
  CUT_LINE_LABEL_PAD,
  CUT_LINE_LABEL_PREFIX,
} from "../constants/cutLineStyle.js";

// Numbering of the cut lines: "L-01", "L-02", … Same rule as the per-listing
// auto-numbering (getNextAutoNumberLabel): max of the labels strictly made of
// the prefix + digits, plus one. Labels of another form are ignored.
const NUMBERING = {
  autoNumberPrefix: CUT_LINE_LABEL_PREFIX,
  autoNumberPadStart: CUT_LINE_LABEL_PAD,
};

// Sequence over the labels of the existing cut lines: every call hands out
// the next label, so the lines of one batch are numbered in order.
export default function createCutLineLabelSequence(existingLabels) {
  const labels = [...(existingLabels ?? [])];
  return () => {
    const label = getNextAutoNumberLabel(NUMBERING, labels);
    labels.push(label);
    return label;
  };
}
