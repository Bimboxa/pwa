import IconReentrantAngle from "Features/annotations/components/IconReentrantAngle";

import ButtonReentrantAngles from "./ButtonReentrantAngles";
import {
  getSelectionGate,
  getTargets,
} from "../../utils/selectionCommandState";

// « Angles rentrants »: creates POINT annotations (chosen template) at the
// reentrant angles between the selected polylines and polygons
// (useCreateReentrantAngleAnnotations).
export default {
  key: "REENTRANT_ANGLES",
  label: "Angles rentrants",
  Icon: IconReentrantAngle,
  Button: ButtonReentrantAngles,
  getState(ctx) {
    const gate = getSelectionGate(ctx, { min: 2 });
    if (gate) return gate;
    const targets = getTargets(ctx);
    const ok =
      targets.some((a) => a.type === "POLYLINE") &&
      targets.some((a) => a.type === "POLYGON");
    return ok
      ? { enabled: true }
      : {
          enabled: false,
          reason: "Sélectionnez des lignes et des surfaces",
        };
  },
};
