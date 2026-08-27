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
  CenterFocusStrong as DetailIcon,
} from "@mui/icons-material";

import useDetailBaseMaps from "Features/baseMaps/hooks/useDetailBaseMaps";

// ---------------------------------------------------------------------------
// SectionDetailBaseMaps — "Détails" section of the Fond de plan left panel:
// the detail baseMaps of the project (isDetail, created by dropping a PDF
// page from the Resources panel). Rendered from raw records — selecting one
// triggers the on-the-fly image generation in BaseMap.createFromRecord.
// ---------------------------------------------------------------------------

export default function SectionDetailBaseMaps() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Détails";

  // data

  const detailBaseMaps = useDetailBaseMaps();
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  // state

  const [expanded, setExpanded] = useState(true);

  // handlers

  function handleDetailClick(record) {
    dispatch(setSelectedMainBaseMapId(record.id));
  }

  // render

  if (!detailBaseMaps?.length) return null;

  return (
    <Box>
      {/* Section header — same left structure as the listing group rows of
          BaseMapTree (3px selection-bar slot + chevron + 28px icon). */}
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
          sx={{ p: 0, mr: 0.5 }}
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
          <DetailIcon color="action" />
        </Box>
        <ListItemText primary={titleS} />
      </ListItemButton>

      {expanded && (
        <List dense disablePadding>
          {detailBaseMaps.map((record) => {
            const isSelected = selectedBaseMapId === record.id;
            return (
              <ListItemButton
                key={record.id}
                onClick={() => handleDetailClick(record)}
                sx={{
                  pl: 5,
                  borderLeft: "3px solid",
                  borderLeftColor: isSelected
                    ? "secondary.main"
                    : "transparent",
                }}
              >
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
                      {record.name}
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
