import { useState, useMemo } from "react";
import { useSelector } from "react-redux";

import { Box, List, Typography, Divider } from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ChevronRight from "@mui/icons-material/ChevronRight";

import RowPanelDrawingTemplate from "./RowPanelDrawingTemplate";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";

// ---------------------------------------------------------------------------
// SectionViewerListing — one listing section of the Viewer panel: collapsible
// header (listing name + "N types · M u") over the read-only template rows.
// Scope: templates with an annotation on the displayed base maps
// (visibleTemplateIds), then the Tous / Visibles / Masqués filter.
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
  const unitsCount = filteredTemplates.reduce(
    (acc, t) => acc + (qtiesById?.[t.id]?.unit ?? 0),
    0
  );
  const summaryS = `${typesCount} type${typesCount > 1 ? "s" : ""} · ${unitsCount} u`;

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
          px: 1,
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
        <Typography
          variant="caption"
          noWrap
          sx={{
            fontFamily: "monospace",
            color: "text.secondary",
            flexShrink: 0,
          }}
        >
          {summaryS}
        </Typography>
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
