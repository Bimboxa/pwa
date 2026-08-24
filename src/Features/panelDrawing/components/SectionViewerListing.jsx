import { useState, useMemo } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  List,
  Typography,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import RowPanelDrawingTemplate from "./RowPanelDrawingTemplate";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useUpdateAnnotationTemplates from "Features/annotations/hooks/useUpdateAnnotationTemplates";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";

// ---------------------------------------------------------------------------
// SectionViewerListing — one listing section of the Viewer panel: collapsible
// header (listing name + a listing-level eye toggling every template of the
// listing, like the PopperMapListings listing eye) over the read-only
// template rows. Scope: templates with an annotation on the displayed base
// maps (visibleTemplateIds), then the Tous / Visibles / Masqués filter.
// ---------------------------------------------------------------------------

export default function SectionViewerListing({
  listing,
  visibleTemplateIds,
  qtiesById,
  spriteImage,
}) {
  // data

  const allTemplates = useAnnotationTemplates({
    filterByListingId: listing.id,
    sortByOrder: true,
  });
  const updateAnnotationTemplates = useUpdateAnnotationTemplates();
  const templateFilter = useSelector((s) => s.panelDrawing.templateFilter);

  // state

  const [collapsed, setCollapsed] = useState(false);

  // helpers

  const filteredTemplates = useMemo(() => {
    let arr = (allTemplates ?? []).filter((t) => visibleTemplateIds.has(t.id));
    if (templateFilter === "VISIBLE") arr = arr.filter((t) => !t.hidden);
    if (templateFilter === "HIDDEN") arr = arr.filter((t) => t.hidden);
    return arr;
  }, [allTemplates, visibleTemplateIds, templateFilter]);

  const groupedItems = useMemo(
    () => groupAnnotationTemplatesByGroupLabel(filteredTemplates),
    [filteredTemplates]
  );

  const typesCount = filteredTemplates.length;

  // The listing eye mirrors the template eyes: off when every template of
  // the listing is hidden (same rule as the popper).
  const isHidden =
    (allTemplates ?? []).length > 0 && allTemplates.every((t) => t.hidden);

  // handlers

  // Batch-toggle every template eye of the listing in one write, only
  // touching templates whose `hidden` actually changes.
  async function handleToggleVisibility(e) {
    e.stopPropagation();
    const targetHidden = !isHidden;
    const updates = (allTemplates ?? [])
      .filter((t) => Boolean(t.hidden) !== targetHidden)
      .map((t) => ({ id: t.id, hidden: targetHidden }));
    await updateAnnotationTemplates(updates);
  }

  // render

  if (typesCount === 0) return null;

  return (
    <Box>
      {/* Listing header */}
      <Box
        onClick={() => setCollapsed(!collapsed)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          pl: 1,
          // Same right padding as the template rows so the eye column lines up.
          pr: 0.5,
          py: 1,
          cursor: "pointer",
          bgcolor: "panel.sectionBg",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          userSelect: "none",
          "&:hover": { bgcolor: "panel.border" },
        }}
      >
        {collapsed ? (
          <ChevronRight sx={{ fontSize: 18, color: "panel.textLight" }} />
        ) : (
          <ExpandMore sx={{ fontSize: 18, color: "panel.textLight" }} />
        )}
        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, fontWeight: 700, minWidth: 0 }}
        >
          {listing.name ?? listing.label ?? "Liste"}
        </Typography>
        <Tooltip title={isHidden ? "Afficher" : "Masquer"} arrow>
          <IconButton
            size="small"
            onClick={handleToggleVisibility}
            sx={{
              p: 0.5,
              flexShrink: 0,
              color: isHidden ? "secondary.main" : "panel.iconMuted",
            }}
          >
            {isHidden ? (
              <VisibilityOff sx={{ fontSize: 16 }} />
            ) : (
              <Visibility sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>
        {/* Spacer matching the rows' chevron width, so the eyes align. */}
        <Box sx={{ width: 18, flexShrink: 0 }} />
      </Box>

      {/* Template rows */}
      {!collapsed && (
        <List dense disablePadding sx={{ bgcolor: "background.paper" }}>
          {groupedItems?.map((item, idx) => {
            if (item.isGroupDivider) {
              return (
                <Divider
                  key={`divider-${idx}`}
                  sx={{ mx: 2, my: 0.5, borderColor: "divider" }}
                />
              );
            }
            if (item.isGroupHeader) {
              return (
                <Typography
                  key={`group-${item.groupLabel}`}
                  variant="caption"
                  sx={{
                    display: "block",
                    pl: 2,
                    pt: idx > 0 ? 1 : 0.5,
                    pb: 0.5,
                    color: "text.secondary",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    fontSize: "0.7rem",
                    letterSpacing: 0.5,
                  }}
                >
                  {item.groupLabel}
                </Typography>
              );
            }
            if (item?.isDivider) return null;
            return (
              <RowPanelDrawingTemplate
                key={item.id}
                annotationTemplate={item}
                listingId={listing.id}
                qties={qtiesById?.[item.id]}
                spriteImage={spriteImage}
                dndEnabled={false}
                readOnly
              />
            );
          })}
        </List>
      )}
    </Box>
  );
}
