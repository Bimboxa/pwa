import { useState } from "react";

import useCreateReentrantAngleAnnotations from "Features/annotations/hooks/useCreateReentrantAngleAnnotations";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import CommandButton from "../../components/CommandButton";
import MenuPickAnnotationTemplate from "../../components/MenuPickAnnotationTemplate";
import { getTargets } from "../../utils/selectionCommandState";

export default function ButtonReentrantAngles({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  const createReentrantAngles = useCreateReentrantAngleAnnotations();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // handlers

  async function handleTemplateChange(annotationTemplateId) {
    try {
      await createReentrantAngles({
        annotations: getTargets(ctx),
        annotationTemplateId,
      });
    } catch (e) {
      console.error("[reentrantAngles]", e);
    } finally {
      setAnchorEl(null);
    }
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, active: open }}
        onClick={(event, anchor) => setAnchorEl(anchor)}
      />
      <MenuPickAnnotationTemplate
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        filterTemplate={(t) => resolveDrawingShape(t) === "POINT"}
        onChange={handleTemplateChange}
        emptyText="Aucun modèle de point"
      />
    </>
  );
}
