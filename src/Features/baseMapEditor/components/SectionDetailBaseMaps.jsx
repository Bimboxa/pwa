import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Avatar,
  InputBase,
} from "@mui/material";
import {
  ExpandMore,
  ChevronRight,
  Folder,
  FolderOpen,
  Check,
  Close,
} from "@mui/icons-material";

import IconButtonMoreActionsBaseMap from "./IconButtonMoreActionsBaseMap";

import useDetailBaseMaps from "Features/baseMaps/hooks/useDetailBaseMaps";
import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";
import db from "App/db/db";

// ---------------------------------------------------------------------------
// SectionDetailBaseMaps — "Détails" section of the Fond de plan left panel:
// the detail baseMaps of the project (isDetail, created by dropping a PDF
// page from the Resources panel). Rendered from raw records — selecting one
// triggers the on-the-fly image generation in BaseMap.createFromRecord.
// Header and rows mirror the BaseMapTree group / base map row styles.
// Writes go straight to db.baseMaps: details have no listing (listingId
// null), so the listing-driven entity machinery does not apply.
// ---------------------------------------------------------------------------

export default function SectionDetailBaseMaps() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Détails";
  const pageS = "Page";
  const detailS = "Détail";

  // data

  const detailBaseMaps = useDetailBaseMaps();
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // state

  const [expanded, setExpanded] = useState(true);
  // Inline editing — one row / one field at a time ("name" | "detailRef").
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState("");

  // helpers

  const isDisplayed = detailBaseMaps?.some(
    (record) => record.id === selectedBaseMapId
  );

  // handlers

  function handleDetailClick(record) {
    if (editingId === record.id) return;
    dispatch(setSelectedMainBaseMapId(record.id));
    dispatch(setSelectedItem({ id: record.id, type: "BASE_MAP" }));
  }

  function handleStartEdit(record, field) {
    setEditingId(record.id);
    setEditingField(field);
    setTempValue((field === "name" ? record.name : record.detailRef) ?? "");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditingField(null);
    setTempValue("");
  }

  async function handleConfirmEdit() {
    if (editingId && editingField) {
      const value =
        editingField === "detailRef" ? tempValue.trim() || null : tempValue;
      await db.baseMaps.update(editingId, { [editingField]: value });
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
    }
    handleCancelEdit();
  }

  // render

  if (!detailBaseMaps?.length) return null;

  return (
    <Box>
      {/* Section header — same structure as the listing group rows of
          BaseMapTree (3px selection-bar slot + chevron + 28px folder icon). */}
      <ListItemButton
        component="div"
        onClick={() => setExpanded((e) => !e)}
        sx={{ pl: 2, py: 1.5, borderLeft: "3px solid transparent" }}
      >
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((e2) => !e2);
          }}
          // ml compensates the tree rows' drag handle slot (DragIndicator
          // 14px with ml -12px + mr 4px ≈ 6px) so icons align across sections.
          sx={{ p: 0, mr: 0.5, ml: "6px" }}
        >
          {expanded ? (
            <ExpandMore sx={{ fontSize: 20 }} />
          ) : (
            <ChevronRight sx={{ fontSize: 20 }} />
          )}
        </IconButton>
        <Box
          sx={{
            width: 28,
            height: 28,
            mr: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {expanded ? <FolderOpen color="action" /> : <Folder color="action" />}
        </Box>
        <ListItemText
          primary={titleS}
          slotProps={{
            primary: {
              variant: "body2",
              fontWeight: isDisplayed ? "bold" : "normal",
            },
          }}
        />
      </ListItemButton>

      {expanded && (
        // White background isolating the detail rows from the panel, same
        // as the base map groups of BaseMapTree.
        <Box
          sx={{
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <List dense disablePadding>
            {detailBaseMaps.map((record) => {
              const isSelected = selectedBaseMapId === record.id;
              const isEditing = editingId === record.id;
              const { label: nameS } = getBaseMapDisplayName(record);
              const pageNumber = record.createdFrom?.pageNumber;
              const detailRef = record.detailRef;
              const subtitleS = [
                detailRef ? `${detailS} ${detailRef}` : detailS,
                pageNumber && `${pageS} ${pageNumber}`,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <ListItemButton
                  key={record.id}
                  onClick={() => handleDetailClick(record)}
                  sx={{
                    // Same left structure as the base map rows (selection bar +
                    // chevron column) so the avatars align across sections.
                    pl: 5,
                    borderLeft: "3px solid",
                    borderLeftColor: isSelected
                      ? "secondary.main"
                      : "transparent",
                  }}
                >
                  {/* Chevron placeholder — details have no versions; keeps the
                      avatar aligned with the tree's base map rows (ml = drag
                      handle slot, width = chevron column). */}
                  <Box sx={{ width: 20, mr: 0.5, ml: "6px", flexShrink: 0 }} />
                  <Avatar
                    src={record.image?.thumbnail}
                    variant="rounded"
                    sx={{
                      width: 28,
                      height: 28,
                      mr: 1,
                      border: "1px solid",
                      borderColor: isSelected ? "secondary.main" : "grey.300",
                    }}
                  />
                  {isEditing ? (
                    <InputBase
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleConfirmEdit();
                        else if (e.key === "Escape") handleCancelEdit();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder={
                        editingField === "detailRef" ? "1, A, ..." : undefined
                      }
                      autoFocus
                      sx={{ fontSize: "0.875rem", flex: 1 }}
                    />
                  ) : (
                    <ListItemText
                      disableTypography
                      primary={
                        <Typography variant="body2" noWrap>
                          {nameS}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ display: "block" }}
                          color="text.secondary"
                        >
                          {subtitleS}
                        </Typography>
                      }
                    />
                  )}
                  {isEditing ? (
                    <Box sx={{ display: "flex", ml: 1 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmEdit();
                        }}
                        sx={{ color: "success.main" }}
                      >
                        <Check fontSize="inherit" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        sx={{ color: "error.main" }}
                      >
                        <Close fontSize="inherit" />
                      </IconButton>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex" }}>
                      <IconButtonMoreActionsBaseMap
                        baseMap={record}
                        onRename={() => handleStartEdit(record, "name")}
                        onEditRef={() => handleStartEdit(record, "detailRef")}
                      />
                    </Box>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      )}
    </Box>
  );
}
