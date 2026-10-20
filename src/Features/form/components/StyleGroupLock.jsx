import { IconButton } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import { STYLE_FIELD_LABELS } from "Features/form/utils/styleFieldGroups";

// Section-level padlock shared by the compact style editors (fill / stroke /
// stroke width). `fields` is the group toggled together.
//
// Template form (onOverrideFieldsChange given): the lock is CLOSED as soon as
// ONE field of the group is locked. Libraries written with the former
// per-field padlocks carry partial sets (e.g. ["fillColor"] alone): such a
// lock used to render open while the colour was really forced by the
// template. A partial lock is tinted warning and names the locked fields;
// clicking it releases the whole group (one click, not two).
//
// Annotation form (disabledFields given, no handler): a read-only closed lock
// explains why the greyed fields cannot be edited.
export default function StyleGroupLock({
  fields,
  overrideFields,
  onOverrideFieldsChange,
  disabledFields,
  lockTitle,
}) {
  // helpers

  const showOverrides = typeof onOverrideFieldsChange === "function";

  const lockedFields = fields.filter(
    (f) => Array.isArray(overrideFields) && overrideFields.includes(f)
  );
  const anyLocked = lockedFields.length > 0;
  const allLocked = lockedFields.length === fields.length;

  const lockedByTemplate = fields.filter(
    (f) => Array.isArray(disabledFields) && disabledFields.includes(f)
  );

  const labelsOf = (list) =>
    Array.from(new Set(list.map((f) => STYLE_FIELD_LABELS[f] ?? f))).join(", ");

  // handlers

  function handleToggle() {
    const current = Array.isArray(overrideFields) ? [...overrideFields] : [];
    const next = anyLocked
      ? current.filter((f) => !fields.includes(f))
      : Array.from(new Set([...current, ...fields]));
    onOverrideFieldsChange(next);
  }

  // render

  if (showOverrides) {
    const partial = anyLocked && !allLocked;
    const title = partial
      ? `Verrou partiel : ${labelsOf(lockedFields)}. Cliquer pour déverrouiller.`
      : lockTitle;
    const color = allLocked
      ? "primary.main"
      : partial
        ? "warning.main"
        : "text.disabled";
    return (
      <IconButton
        size="small"
        onClick={handleToggle}
        title={title}
        sx={{ color }}
      >
        {anyLocked ? (
          <LockIcon fontSize="small" />
        ) : (
          <LockOpenIcon fontSize="small" />
        )}
      </IconButton>
    );
  }

  if (lockedByTemplate.length === 0) return null;

  return (
    <IconButton
      size="small"
      disabled
      title={`Verrouillé par le modèle : ${labelsOf(lockedByTemplate)}`}
      sx={{ "&.Mui-disabled": { color: "text.disabled" } }}
    >
      <LockIcon fontSize="small" />
    </IconButton>
  );
}
