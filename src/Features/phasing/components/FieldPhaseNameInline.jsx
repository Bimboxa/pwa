import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useUpdateBusinessObject from "Features/businessObjects/hooks/useUpdateBusinessObject";

import FieldNameInline from "./FieldNameInline";

// Name of a phase in the phases strip, renamed in place (FieldNameInline).
export default function FieldPhaseNameInline({ phase }) {
  const dispatch = useDispatch();
  const updateBusinessObject = useUpdateBusinessObject();

  // strings

  const renameS = "Renommer la phase";
  const errorS = "La phase n'a pas pu être renommée.";

  // handlers

  async function handleCommit(label) {
    try {
      await updateBusinessObject(phase.id, { label });
    } catch (error) {
      console.error("[FieldPhaseNameInline]", error);
      dispatch(
        setToaster({ message: error?.message || errorS, isError: true })
      );
    }
  }

  // render

  return (
    <FieldNameInline
      value={phase.label}
      onCommit={handleCommit}
      tooltip={renameS}
      sx={{ fontWeight: 600 }}
    />
  );
}
