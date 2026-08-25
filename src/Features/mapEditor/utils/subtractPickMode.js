// The subtraction pick mode is anchored on one annotation (the "pivot") and
// runs in two directions, both writing to the same db.relAnnotationSubtractions
// row — only the argument order of the service changes:
//
//   subtractSourceAnnotationId  the pivot is CARVED; each clicked annotation is
//                               subtracted from it   ("Soustraire une annotation")
//   subtractTargetAnnotationId  the pivot is SUBTRACTED; each clicked annotation
//                               becomes a carved source        ("À soustraire de")
//
// The two flags are mutually exclusive (see mapEditorSlice). Code that only
// asks "is a subtraction pick mode active?" — hotkey guards, Escape, the popper
// priority chain — must use the selector below instead of reading one flag.

export const selectSubtractPickAnnotationId = (s) =>
  s.mapEditor.subtractSourceAnnotationId ||
  s.mapEditor.subtractTargetAnnotationId;
