import { getDrawingCommitInterceptor } from "../services/drawingCommitInterceptors";

// Renders the dialog of the pending deferred drawing commit (see
// useDeferredDrawingCommit): looks up the interceptor entry by pending.key
// and mounts its DialogComponent with the resume / cancel callbacks.
export default function DeferredCommitDialogOutlet({
  pending,
  onResume,
  onCancel,
}) {
  if (!pending) return null;
  const entry = getDrawingCommitInterceptor(pending.key);
  const DialogComponent = entry?.DialogComponent;
  if (!DialogComponent) return null;
  return (
    <DialogComponent
      pending={pending}
      onResume={onResume}
      onCancel={onCancel}
    />
  );
}
