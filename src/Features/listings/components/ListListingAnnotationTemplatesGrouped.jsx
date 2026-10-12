import { useMemo, useState } from "react";

import { Box, Divider, ListItemButton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronRight, DragIndicator } from "@mui/icons-material";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";
import useDndSensors from "App/hooks/useDndSensors";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationTemplateQtiesById from "Features/annotations/hooks/useAnnotationTemplateQtiesById";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";

// ---------------------------------------------------------------------------
// ListListingAnnotationTemplatesGrouped — the "Modèles" card of the listing
// properties panel. Same grouped rendering as the PopperMapListings (group
// headers / dividers from groupLabel, one compact row per template, drag &
// drop reorder on orderIndex) without the editor-only controls (solo, eye,
// draw tools). The whole row + the chevron open the template detail.
// `annotationTemplates` must already be sorted by order (sortByOrder).
// ---------------------------------------------------------------------------

function getTemplateColor(template) {
  return template?.fillColor ?? template?.strokeColor ?? "#999";
}

function SortableTemplateRow({ template, spriteImage, qtyLabel, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: template.id });

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const color = getTemplateColor(template);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // render

  return (
    <Box ref={setNodeRef} style={style} {...attributes}>
      <ListItemButton
        onClick={() => onSelect(template)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          alignItems: "center",
          pl: 1,
          pr: 0.5,
          py: 0.5,
          borderLeft: "3px solid",
          borderColor: isHovered ? color : "transparent",
          "&:hover": { bgcolor: alpha(color, 0.1) },
        }}
      >
        {/* Drag handle (visible on hover) */}
        <Box
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          sx={{
            display: "flex",
            alignItems: "center",
            cursor: "grab",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.15s",
            mr: 0.5,
            flexShrink: 0,
          }}
        >
          <DragIndicator sx={{ fontSize: 16, color: "panel.textLight" }} />
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            mr: 1,
            flexShrink: 0,
          }}
        >
          <AnnotationTemplateIcon
            template={template}
            size={18}
            spriteImage={spriteImage}
          />
        </Box>

        <Typography
          variant="body2"
          noWrap
          sx={{ flex: 1, minWidth: 0, lineHeight: 1.3, userSelect: "none" }}
        >
          {template.label}
          {template.height != null && (
            <Typography
              component="span"
              sx={{ fontSize: "10px", color: "text.secondary", ml: 0.5 }}
            >
              [ht. {template.height}m]
            </Typography>
          )}
        </Typography>

        {qtyLabel && (
          <Typography
            align="right"
            noWrap
            sx={{
              fontSize: "10px",
              fontFamily: "monospace",
              fontWeight: 500,
              color: "secondary.main",
              ml: 1,
              flexShrink: 0,
            }}
          >
            {qtyLabel}
          </Typography>
        )}

        <ChevronRight sx={{ fontSize: 16, color: "text.disabled", ml: 0.5 }} />
      </ListItemButton>
    </Box>
  );
}

export default function ListListingAnnotationTemplatesGrouped({
  annotationTemplates,
  onSelectTemplate,
}) {
  // data

  const spriteImage = useAnnotationSpriteImage();
  const qtiesById = useAnnotationTemplateQtiesById();
  const sensors = useDndSensors();

  // helpers

  const templates = annotationTemplates ?? [];

  const groupedItems = useMemo(
    () => groupAnnotationTemplatesByGroupLabel(templates),
    [templates]
  );

  // Group headers / dividers are not sortable: only the real templates.
  const templateIds = useMemo(() => templates.map((t) => t.id), [templates]);

  // handlers

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !templates.length) return;

    const oldIndex = templateIds.indexOf(active.id);
    const newIndex = templateIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    let newOrderIndex;
    if (oldIndex < newIndex) {
      const b = templates[newIndex]?.orderIndex ?? null;
      const a =
        newIndex + 1 < templates.length
          ? templates[newIndex + 1]?.orderIndex
          : null;
      newOrderIndex = generateKeyBetween(b, a);
    } else {
      const b = newIndex > 0 ? templates[newIndex - 1]?.orderIndex : null;
      const a = templates[newIndex]?.orderIndex ?? null;
      newOrderIndex = generateKeyBetween(b, a);
    }

    await db.annotationTemplates.update(active.id, {
      orderIndex: newOrderIndex,
    });
  }

  // render

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={templateIds}
        strategy={verticalListSortingStrategy}
      >
        {groupedItems.map((item, idx) => {
          if (item.isGroupDivider) {
            return <Divider key={`divider-${idx}`} sx={{ mx: 1, my: 0.5 }} />;
          }
          if (item.isGroupHeader) {
            return (
              <Typography
                key={`group-${idx}`}
                variant="caption"
                sx={{
                  display: "block",
                  pl: 1,
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
          return (
            <SortableTemplateRow
              key={item.id}
              template={item}
              spriteImage={spriteImage}
              qtyLabel={qtiesById?.[item.id]?.mainQtyLabel}
              onSelect={onSelectTemplate}
            />
          );
        })}
      </SortableContext>
    </DndContext>
  );
}
