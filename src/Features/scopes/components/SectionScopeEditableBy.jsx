import { useState } from "react";

import { Box, Chip, IconButton, Typography } from "@mui/material";
import { Edit, Check, Close } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import parseEditorsTrigrams from "../utils/parseEditorsTrigrams";

// "Modifiable par" — the scope creator lists the trigrams of the users
// granted edit rights on the scope content (scope.editorsTrigrams).
// The db layer keeps the scopes table creator-only, so only the creator can
// actually persist changes to the list.
export default function SectionScopeEditableBy({ scope, isCreator }) {
  // strings

  const appConfig = useAppConfig();
  const label = appConfig?.strings?.scope?.editableByLabel ?? "Modifiable par";
  const helperS = "Trigrammes séparés par ;";

  // data

  const updateScope = useUpdateScope();
  const trigrams = Array.isArray(scope?.editorsTrigrams)
    ? scope.editorsTrigrams
    : [];

  // state

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // handlers

  function handleStartEdit() {
    setDraft(trigrams.join(";"));
    setEditing(true);
  }

  function handleCommit() {
    updateScope({ id: scope.id, editorsTrigrams: parseEditorsTrigrams(draft) });
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  function handleDeleteTrigram(trigram) {
    updateScope({
      id: scope.id,
      editorsTrigrams: trigrams.filter((t) => t !== trigram),
    });
  }

  // render

  if (!scope || (!isCreator && trigrams.length === 0)) return null;

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2">{label}</Typography>
        {isCreator && !editing && (
          <IconButton size="small" onClick={handleStartEdit}>
            <Edit fontSize="small" />
          </IconButton>
        )}
        {isCreator && editing && (
          <Box sx={{ display: "flex" }}>
            <IconButton size="small" onClick={handleCommit}>
              <Check fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleCancel}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      {!editing && trigrams.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
          {trigrams.map((trigram) => (
            <Chip
              key={trigram}
              label={trigram}
              size="small"
              onDelete={
                isCreator ? () => handleDeleteTrigram(trigram) : undefined
              }
            />
          ))}
        </Box>
      )}
      {!editing && trigrams.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          -
        </Typography>
      )}

      {editing && (
        <>
          <FieldTextV2
            value={draft}
            onChange={setDraft}
            options={{
              fullWidth: true,
              autoFocus: true,
              placeholder: "LVS; FLX; MDA",
            }}
          />
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: "block", mt: 0.5 }}
          >
            {helperS}
          </Typography>
        </>
      )}
    </WhiteSectionGeneric>
  );
}
