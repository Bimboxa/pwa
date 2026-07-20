import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { selectSelectedItems } from "Features/selection/selectionSlice";

import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";
import { ExpandMore, ChevronRight } from "@mui/icons-material";

import db from "App/db/db";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useListings from "Features/listings/hooks/useListings";
import useRelsZoneAnnotation from "../hooks/useRelsZoneAnnotation";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

// Right-panel properties of a ZONE selected in the zonings drawer: the
// popper-like legend (annotationTemplates + quantities, grouped by listing
// exactly like PopperMapListings) computed over the annotations effectively
// linked to the zone (relsZoneAnnotation).
export default function PanelZoneProperties() {
  // data — selected zone

  const selectedItems = useSelector(selectSelectedItems);
  const selectedItem = selectedItems[0];
  const zoneId = selectedItem?.type === "ZONE" ? selectedItem.id : null;
  const zonesUpdatedAt = useSelector((s) => s.zonings.zonesUpdatedAt);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const zone = useLiveQuery(async () => {
    if (!zoneId) return null;
    const z = await db.zones.get(zoneId);
    return z && !z.deletedAt ? z : null;
  }, [zoneId, zonesUpdatedAt]);

  // data — annotations linked to the zone

  const { value: rels } = useRelsZoneAnnotation({ zoneId });

  const annotations = useAnnotationsV2({
    caller: "PanelZoneProperties",
    withQties: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    filterBySelectedScope: true,
  });

  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();
  const { value: scopeListings } = useListings({ filterByScopeId: scopeId });

  // state

  const [collapsedListingIds, setCollapsedListingIds] = useState([]);

  // helpers — linked annotations grouped by listing (popper-like legend)

  const linkedAnnotations = useMemo(() => {
    const linkedIds = new Set((rels ?? []).map((r) => r.annotationId));
    return (annotations ?? []).filter((a) => linkedIds.has(a.id));
  }, [rels, annotations]);

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  const groups = useMemo(() => {
    const listingById = getItemsByKey(scopeListings ?? [], "id");
    const byListingId = {};
    linkedAnnotations.forEach((a) => {
      if (!a.listingId) return;
      if (!byListingId[a.listingId]) byListingId[a.listingId] = [];
      byListingId[a.listingId].push(a);
    });
    return Object.entries(byListingId)
      .map(([listingId, listingAnnotations]) => {
        const qtiesById = computeAnnotationTemplateQties(
          listingAnnotations,
          annotationTemplateById
        );
        const rows = Object.entries(qtiesById)
          .map(([templateId, qties]) => ({
            template: annotationTemplateById[templateId],
            qties,
          }))
          .filter((r) => Boolean(r.template))
          // same ordering as the popper: template orderIndex (fractional),
          // label as fallback
          .sort(
            (a, b) =>
              String(a.template.orderIndex ?? "").localeCompare(
                String(b.template.orderIndex ?? "")
              ) ||
              (a.template.label ?? "").localeCompare(b.template.label ?? "")
          );
        return {
          listingId,
          listing: listingById[listingId],
          count: listingAnnotations.length,
          rows,
        };
      })
      // same ordering as the popper: listing rank (fractional)
      .sort((a, b) =>
        String(a.listing?.rank ?? "").localeCompare(
          String(b.listing?.rank ?? "")
        )
      );
  }, [linkedAnnotations, annotationTemplateById, scopeListings]);

  // handlers

  function handleToggleExpand(listingId) {
    setCollapsedListingIds((prev) =>
      prev.includes(listingId)
        ? prev.filter((id) => id !== listingId)
        : [...prev, listingId]
    );
  }

  // render

  if (!zone) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1,
          pl: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            width: 14,
            height: 14,
            minWidth: 14,
            borderRadius: "2px",
            bgcolor: zone.color,
          }}
        />
        <Box>
          <Typography variant="caption" color="text.secondary">
            Zone
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {zone.label}
          </Typography>
        </Box>
      </Box>

      {/* legend: listings → templates + quantities of the linked annotations */}
      <Box sx={{ overflowY: "auto", flex: 1 }}>
        {groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            Aucune annotation liée à cette zone
          </Typography>
        ) : (
          groups.map(({ listingId, listing, count, rows }) => {
            const isExpanded = !collapsedListingIds.includes(listingId);
            return (
              <Box key={listingId}>
                {/* listing header — same look as the popper's ListingRow */}
                <Box
                  onClick={() => handleToggleExpand(listingId)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1,
                    py: 0.75,
                    cursor: "pointer",
                    bgcolor: "panel.sectionBg",
                    "&:hover": { bgcolor: "panel.border" },
                    borderTop: "1px solid",
                    borderColor: "panel.border",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        flexShrink: 0,
                        color: "panel.textLight",
                      }}
                    >
                      {isExpanded ? (
                        <ExpandMore sx={{ fontSize: 18 }} />
                      ) : (
                        <ChevronRight sx={{ fontSize: 18 }} />
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: "panel.textPrimary",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {listing?.name ?? listing?.label ?? "Liste"}
                    </Typography>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{ color: "panel.textMuted", flexShrink: 0 }}
                  >
                    {count}
                  </Typography>
                </Box>

                {isExpanded && (
                  <List dense disablePadding>
                    {rows.map(({ template, qties }) => (
                      <ListItem key={template.id} sx={{ py: 0.25 }}>
                        <Box
                          sx={{
                            mr: 1,
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <AnnotationTemplateIcon
                            template={template}
                            size={20}
                            spriteImage={spriteImage}
                          />
                        </Box>
                        <ListItemText
                          primary={template.label}
                          slotProps={{
                            primary: { variant: "body2", noWrap: true },
                          }}
                        />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ ml: 1, whiteSpace: "nowrap" }}
                        >
                          {qties.mainQtyLabel}
                        </Typography>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
