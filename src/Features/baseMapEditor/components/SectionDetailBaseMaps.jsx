import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Avatar,
} from "@mui/material";
import {
  ExpandMore,
  ChevronRight,
  Folder,
  FolderOpen,
} from "@mui/icons-material";

import useDetailBaseMaps from "Features/baseMaps/hooks/useDetailBaseMaps";
import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";

// ---------------------------------------------------------------------------
// SectionDetailBaseMaps — "Détails" section of the Fond de plan left panel:
// the detail baseMaps of the project (isDetail, created by dropping a PDF
// page from the Resources panel). Rendered from raw records — selecting one
// triggers the on-the-fly image generation in BaseMap.createFromRecord.
// Header and rows mirror the BaseMapTree group / base map row styles.
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

  // helpers

  const isDisplayed = detailBaseMaps?.some(
    (record) => record.id === selectedBaseMapId
  );

  // handlers

  function handleDetailClick(record) {
    dispatch(setSelectedMainBaseMapId(record.id));
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
        <List dense disablePadding>
          {detailBaseMaps.map((record) => {
            const isSelected = selectedBaseMapId === record.id;
            const { label: nameS } = getBaseMapDisplayName(record);
            const pageNumber = record.createdFrom?.pageNumber;
            const subtitleS = [detailS, pageNumber && `${pageS} ${pageNumber}`]
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
              </ListItemButton>
            );
          })}
        </List>
      )}
    </Box>
  );
}
