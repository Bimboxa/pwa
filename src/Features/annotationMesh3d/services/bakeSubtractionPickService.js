import { withUndoGroup } from "App/db/undoManager";

import { setToaster } from "Features/layout/layoutSlice";

import bakeAnnotationSubtractionsService, {
  getBakeSubtractionMessage,
  isAnnotationSubtractionBakeable,
} from "./bakeAnnotationSubtractionsService";

// A click of the subtraction pick mode with « Soustraire définitivement » on
// (shared by the 2D InteractionLayer and the 3D editor): no relation is
// created, the clicked annotations are baked right away.
//
//   forward (« Soustraire une annotation »): pivot = host, each picked
//     annotation is carved out of it — one bake with every picked target;
//   reverse (« À soustraire de… »): pivot = cutter, each picked annotation
//     is a host carved by it — one bake per host, the hosts that cannot be
//     frozen into a mesh are skipped. One undo step for the whole click.
//
// pivot / picked: RESOLVED annotations. Reports the outcome in a toaster.
export default async function bakeSubtractionPickService({
  pivot,
  picked,
  isReverse,
  baseMapsById,
  buildOptions,
  dispatch,
}) {
  const list = (picked ?? []).filter((a) => a?.id && a.id !== pivot?.id);
  if (!pivot || !list.length) {
    dispatch(
      setToaster({
        message: getBakeSubtractionMessage("NOT_FOUND"),
        severity: "warning",
      })
    );
    return;
  }

  if (!isReverse) {
    const result = await bakeAnnotationSubtractionsService({
      host: pivot,
      targets: list,
      baseMapsById,
      buildOptions,
      dispatch,
    });
    dispatch(
      setToaster(
        result.status === "done"
          ? {
              message: "Soustraction définitive appliquée",
              severity: "success",
            }
          : {
              message: getBakeSubtractionMessage(result.reason),
              severity: "warning",
            }
      )
    );
    return;
  }

  const hosts = list.filter(isAnnotationSubtractionBakeable);
  let done = 0;
  let lastReason = hosts.length ? null : "NOT_BAKEABLE";
  await withUndoGroup(async () => {
    for (const host of hosts) {
      const result = await bakeAnnotationSubtractionsService({
        host,
        targets: [pivot],
        baseMapsById,
        buildOptions,
        dispatch,
      });
      if (result.status === "done") done += 1;
      else lastReason = result.reason;
    }
  });
  dispatch(
    setToaster(
      done > 0
        ? {
            message: `${done} annotation(s) creusée(s) définitivement`,
            severity: "success",
          }
        : {
            message: getBakeSubtractionMessage(lastReason),
            severity: "warning",
          }
    )
  );
}
