import getAlignTargets from "Features/annotationAlign/utils/getAlignTargets";

// Selected annotations the align commands move (see getAlignTargets).
export default function getAlignCommandTargets(ctx) {
  return getAlignTargets({
    annotations: ctx.selectedAnnotations,
    baseMapId: ctx.baseMap?.id,
  });
}
