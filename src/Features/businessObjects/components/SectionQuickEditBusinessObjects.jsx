import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  triggerBusinessObjectsUpdate,
  triggerRelsBusinessObjectAnnotationUpdate,
  setSelectedBusinessObjectId,
  setLinkingBusinessObjectId,
} from "../businessObjectsSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, Chip, TextField, Typography } from "@mui/material";

import useBusinessObjects from "../hooks/useBusinessObjects";
import useRelsBusinessObjectAnnotation from "../hooks/useRelsBusinessObjectAnnotation";

import {
  serializeBusinessObjectsTree,
  buildQuickEditDiff,
} from "../utils/businessObjectsQuickEdit";
import applyBusinessObjectsQuickEditService from "../services/applyBusinessObjectsQuickEditService";

// One chip style per change kind of the review list.
const KIND_PROPS = {
  ADD: { label: "Ajout", color: "success" },
  DELETE: { label: "Suppression", color: "error" },
  RENAME: { label: "Renommage", color: "info" },
  MOVE: { label: "Déplacement", color: "warning" },
  ORDER: { label: "Ordre", color: "default" },
  UNIT: { label: "Unité", color: "secondary" },
  TITLE: { label: "Titre", color: "default" },
};

// ---------------------------------------------------------------------------
// SectionQuickEditBusinessObjects — text edition of the whole objects tree of
// a listing. One object per line, TAB = one depth level, unit in trailing
// parentheses: (m) → ml, (m2) → m², (u) → unité. "Mettre à jour" runs the
// diff (adds / deletions / renames / moves / order / unit changes) and shows
// the review list ("x modifications") with Confirmer / Annuler; Confirmer
// applies the whole batch in one transaction.
// ---------------------------------------------------------------------------

export default function SectionQuickEditBusinessObjects({ listing, onClose }) {
  const dispatch = useDispatch();

  // data

  const { value: businessObjects } = useBusinessObjects({
    listingId: listing.id,
  });
  const { value: rels } = useRelsBusinessObjectAnnotation({
    listingId: listing.id,
  });
  const selectedBusinessObjectId = useSelector(
    (s) => s.businessObjects.selectedBusinessObjectId
  );
  const linkingBusinessObjectId = useSelector(
    (s) => s.businessObjects.linkingBusinessObjectId
  );

  // state

  // text seeded ONCE when the live query resolves (editing must not be reset
  // by background live-query refreshes); null = still loading.
  const [text, setText] = useState(null);
  const [review, setReview] = useState(null); // {changes, plan, count} | null
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (text === null && businessObjects !== undefined) {
      setText(serializeBusinessObjectsTree(businessObjects));
    }
  }, [businessObjects, text]);

  // helpers

  const relsCountByObjectId = useMemo(() => {
    const counts = {};
    (rels ?? []).forEach((r) => {
      counts[r.businessObjectId] = (counts[r.businessObjectId] ?? 0) + 1;
    });
    return counts;
  }, [rels]);

  // handlers

  // TAB indents instead of moving the focus: single cursor inserts a tab,
  // a multi-line selection indents each line; Shift+TAB outdents.
  function handleKeyDown(e) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.target;
    const { selectionStart, selectionEnd, value } = el;

    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const isMultiline = value.slice(selectionStart, selectionEnd).includes("\n");

    let newValue;
    let newStart;
    let newEnd;

    if (!e.shiftKey && !isMultiline) {
      newValue =
        value.slice(0, selectionStart) + "\t" + value.slice(selectionEnd);
      newStart = newEnd = selectionStart + 1;
    } else {
      // indent / outdent every line touched by the selection
      const blockEnd = value.indexOf("\n", selectionEnd);
      const end = blockEnd === -1 ? value.length : blockEnd;
      const block = value.slice(lineStart, end);
      const edited = block
        .split("\n")
        .map((line) =>
          e.shiftKey ? line.replace(/^(\t| {2})/, "") : "\t" + line
        );
      const newBlock = edited.join("\n");
      newValue = value.slice(0, lineStart) + newBlock + value.slice(end);
      newStart = lineStart;
      newEnd = lineStart + newBlock.length;
    }

    setText(newValue);
    requestAnimationFrame(() => el.setSelectionRange(newStart, newEnd));
  }

  function handleDetectChanges() {
    const diff = buildQuickEditDiff({
      listing,
      businessObjects: businessObjects ?? [],
      text,
    });
    if (diff.count === 0) {
      dispatch(setToaster({ message: "Aucune modification détectée" }));
      return;
    }
    setReview(diff);
  }

  async function handleConfirm() {
    if (!review || applying) return;
    setApplying(true);
    try {
      await applyBusinessObjectsQuickEditService({ plan: review.plan });

      // a deleted object can't stay selected / armed for linking
      if (review.plan.deletionIds.includes(selectedBusinessObjectId))
        dispatch(setSelectedBusinessObjectId(null));
      if (review.plan.deletionIds.includes(linkingBusinessObjectId))
        dispatch(setLinkingBusinessObjectId(null));

      dispatch(triggerBusinessObjectsUpdate());
      if (review.plan.deletionIds.length > 0)
        dispatch(triggerRelsBusinessObjectAnnotationUpdate());
      dispatch(
        setToaster({
          message: `${review.count} modification${
            review.count > 1 ? "s" : ""
          } appliquée${review.count > 1 ? "s" : ""}`,
        })
      );
      onClose();
    } catch (e) {
      console.error("[SectionQuickEditBusinessObjects] apply failed", e);
      dispatch(
        setToaster({
          message: "Erreur lors de la mise à jour — réessayez.",
          isError: true,
        })
      );
      setApplying(false);
    }
  }

  // render

  if (text === null) return null; // objects still loading

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        px: 1.5,
        pb: 1.5,
        gap: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Une ligne par ouvrage, TAB pour l&apos;indentation. Unité entre
        parenthèses : (m), (m2), (u) — sans parenthèses : pas d&apos;unité.
        Titres entre crochets : [m2], ou [] sans unité.
      </Typography>

      {!review && (
        <>
          <TextField
            multiline
            fullWidth
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            slotProps={{
              input: {
                sx: {
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                  alignItems: "flex-start",
                  height: 1,
                  overflow: "auto",
                  "& textarea": { height: "100% !important", overflow: "auto !important" },
                },
              },
            }}
            sx={{ flex: 1, minHeight: 0, "& .MuiInputBase-root": { height: 1 } }}
          />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button size="small" onClick={onClose} sx={{ flex: 1 }}>
              Fermer
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleDetectChanges}
              sx={{ flex: 2 }}
            >
              Mettre à jour
            </Button>
          </Box>
        </>
      )}

      {review && (
        <>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {`${review.count} modification${review.count > 1 ? "s" : ""}`}
          </Typography>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
            }}
          >
            {review.changes.map((change, idx) => {
              const relsCount = change.kinds.includes("DELETE")
                ? (relsCountByObjectId[change.businessObjectId] ?? 0)
                : 0;
              return (
                <Box
                  key={idx}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 0.5,
                    px: 1,
                    py: 0.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    "&:last-child": { borderBottom: "none" },
                  }}
                >
                  {change.kinds.map((kind) => (
                    <Chip
                      key={kind}
                      label={KIND_PROPS[kind]?.label ?? kind}
                      color={KIND_PROPS[kind]?.color ?? "default"}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: "0.65rem" }}
                    />
                  ))}
                  <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                    {change.from ? `${change.from} → ${change.label}` : change.label}
                  </Typography>
                  {relsCount > 0 && (
                    <Typography variant="caption" color="error.main">
                      {`(${relsCount} annotation${relsCount > 1 ? "s" : ""} liée${
                        relsCount > 1 ? "s" : ""
                      })`}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              onClick={() => setReview(null)}
              disabled={applying}
              sx={{ flex: 1 }}
            >
              Annuler
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleConfirm}
              disabled={applying}
              sx={{ flex: 2 }}
            >
              Confirmer
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
