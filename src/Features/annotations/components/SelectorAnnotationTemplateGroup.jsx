import { useMemo, useState } from "react";

import { Box, Typography, Popover, ButtonBase, InputBase } from "@mui/material";
import { ExpandMore, Add } from "@mui/icons-material";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import normalizeGroupLabel from "../utils/normalizeGroupLabel";

// Group picker for an annotation template: replaces the free-text "Groupe"
// field with a searchable, creatable list of the groups that already exist in
// the current project, so casing/whitespace duplicates ("Réseaux" / "réseaux ")
// are avoided. Selecting or creating a group writes its trimmed label to
// `groupLabel`; "Aucun groupe" clears it.
//
//   value: groupLabel string
//   onChange(nextGroupLabel)
export default function SelectorAnnotationTemplateGroup({ value, onChange }) {
  // data

  const annotationTemplates = useAnnotationTemplates();

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [search, setSearch] = useState("");

  const open = Boolean(anchorEl);

  // helpers

  const currentLabel = value?.trim() || "";

  // distinct existing groups (first casing wins), alphabetical
  const groups = useMemo(() => {
    const byNormalized = new Map();
    (annotationTemplates ?? []).forEach((template) => {
      const raw = template?.groupLabel?.trim();
      if (!raw) return;
      const key = normalizeGroupLabel(raw);
      if (!byNormalized.has(key)) byNormalized.set(key, raw);
    });
    return [...byNormalized.values()].sort((a, b) => a.localeCompare(b));
  }, [annotationTemplates]);

  const query = search.trim();
  const filteredGroups = query
    ? groups.filter((g) => g.toLowerCase().includes(query.toLowerCase()))
    : groups;

  const showCreate =
    query.length > 0 &&
    !groups.some((g) => normalizeGroupLabel(g) === normalizeGroupLabel(query));

  const popoverWidth = anchorEl ? anchorEl.clientWidth : 220;

  // handlers

  function handleOpen(e) {
    setSearch("");
    setAnchorEl(e.currentTarget);
  }
  function handleClose() {
    setAnchorEl(null);
    setSearch("");
  }
  function handleSelect(group) {
    onChange(group);
    handleClose();
  }
  function handleClear() {
    onChange("");
    handleClose();
  }
  function handleCreate() {
    onChange(query);
    handleClose();
  }

  // render

  return (
    <>
      <ButtonBase
        onClick={handleOpen}
        title="Groupe"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          width: 1,
          height: 34,
          px: 1,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          bgcolor: "background.paper",
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            textAlign: "left",
            color: currentLabel ? "text.primary" : "text.disabled",
          }}
        >
          {currentLabel || "Aucun groupe"}
        </Typography>
        <ExpandMore fontSize="small" sx={{ color: "text.secondary" }} />
      </ButtonBase>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: { mt: 1, width: popoverWidth, borderRadius: 2, boxShadow: 6 },
          },
        }}
      >
        <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
          <InputBase
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher ou créer…"
            autoFocus
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              px: 1,
              height: 30,
              fontSize: "0.8rem",
              mb: 0.5,
            }}
          />

          <ButtonBase
            onClick={handleClear}
            sx={{
              justifyContent: "flex-start",
              px: 1,
              py: 0.75,
              borderRadius: 1,
              bgcolor: !currentLabel ? "action.selected" : "transparent",
            }}
          >
            <Typography variant="body2" sx={{ color: "text.disabled" }}>
              Aucun groupe
            </Typography>
          </ButtonBase>

          {filteredGroups.map((group) => {
            const selected =
              normalizeGroupLabel(group) === normalizeGroupLabel(currentLabel);
            return (
              <ButtonBase
                key={group}
                onClick={() => handleSelect(group)}
                sx={{
                  justifyContent: "flex-start",
                  px: 1,
                  py: 0.75,
                  borderRadius: 1,
                  bgcolor: selected ? "action.selected" : "transparent",
                }}
              >
                <Typography
                  variant="body2"
                  noWrap
                  sx={{ textAlign: "left", width: 1 }}
                >
                  {group}
                </Typography>
              </ButtonBase>
            );
          })}

          {showCreate && (
            <ButtonBase
              onClick={handleCreate}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                justifyContent: "flex-start",
                px: 1,
                py: 0.75,
                mt: 0.5,
                borderTop: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                color: "primary.main",
              }}
            >
              <Add fontSize="small" />
              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                {`Créer « ${query} »`}
              </Typography>
            </ButtonBase>
          )}
        </Box>
      </Popover>
    </>
  );
}
