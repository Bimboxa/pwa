// Maps a cell `bind` token (computeTitleBlockLayout texts[].bind) to the
// editable draft slot it writes to in the title block edit dialog.
// Returns null for computed / read-only cells (pageNum, bare project.name).
export default function getTitleBlockBindTarget(bind) {
  if (!bind) return null;
  if (bind.startsWith("field:")) return { kind: "field", key: bind.slice(6) };
  if (bind === "portfolio.name") return { kind: "portfolioName" };
  if (bind === "page.title") return { kind: "pageTitle" };
  return null;
}

export function readDraftValue(draft, target) {
  if (!target) return "";
  if (target.kind === "field") return draft.values?.[target.key] ?? "";
  return draft[target.kind] ?? "";
}

export function writeDraftValue(draft, target, value) {
  if (!target) return draft;
  if (target.kind === "field") {
    return { ...draft, values: { ...draft.values, [target.key]: value } };
  }
  return { ...draft, [target.kind]: value };
}
