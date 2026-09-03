import { setToaster } from "Features/layout/layoutSlice";

import fireFlash from "./fireFlash";

/**
 * Shared user feedback of an ANNOTATIONS_CREATOR procedure run (flash +
 * toaster), so every launch path reports the same way: ProcedureActionButtons
 * (play / refresh) and ProcedureAutoLaunchDialogOutlet (auto-open on source
 * commit).
 */
export default function notifyProcedureRunResult(dispatch, result) {
  const created = result?.annotations?.length ?? 0;
  const updated = result?.updatedAnnotations?.length ?? 0;
  if (created > 0 || updated > 0) {
    fireFlash();
    const message =
      created > 0
        ? `${created} annotation(s) créée(s)`
        : `${updated} annotation(s) mise(s) à jour`;
    dispatch(setToaster({ message }));
  } else if (result?.error) {
    // procedure-specific failure message (e.g. open frontier loop)
    dispatch(setToaster({ message: result.error, severity: "warning" }));
  } else {
    dispatch(
      setToaster({
        message:
          "Aucune annotation créée. Vérifiez les catégories des modèles.",
        severity: "warning",
      })
    );
  }
}
