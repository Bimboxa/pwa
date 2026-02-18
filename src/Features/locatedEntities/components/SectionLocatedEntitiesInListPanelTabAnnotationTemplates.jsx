import { useState, useRef } from "react";
import { useDispatch } from "react-redux";
import { useDraggable, useDndMonitor, DragOverlay } from "@dnd-kit/core";
import {
  List,
  ListItemButton,
  Typography,
  Box,
  Popper,
  Paper,
  Fade,
} from "@mui/material";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";
import ToolbarCreateAnnotationFromTabAnnotationTemplates from "Features/annotations/components/ToolbarCreateAnnotationFromTabAnnotationTemplates";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonAnnotationTemplatesDownload from "Features/annotations/components/IconButtonAnnotationTemplatesDownload";
import IconButtonAnnotationTemplatesUpload from "Features/annotations/components/IconButtonAnnotationTemplatesUpload";
import IconButtonActionCreateAnnotationTemplate from "Features/annotations/components/IconButtonActionCreateAnnotationTemplate";

import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useAnnotationTemplateCountById from "Features/annotations/hooks/useAnnotationTemplateCountById";
import useAnnotationTemplateQtiesById from "Features/annotations/hooks/useAnnotationTemplateQtiesById";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

function DraggableAnnotationTemplateItem({
  annotationTemplate,
  count,
  qtyLabel,
  spriteImage,
  onCreateClick,
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `annotation-template-${annotationTemplate.id}`,
      data: {
        type: "annotationTemplate",
        annotationTemplateId: annotationTemplate.id,
      },
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const [anchorEl, setAnchorEl] = useState(null);
  const hoverTimeoutRef = useRef(null);
  const isOpen = Boolean(anchorEl);

  const handleListItemEnter = (event) => {
    // On annule toute fermeture en cours pour cet item
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setAnchorEl(event.currentTarget);
  };

  const handleListItemLeave = () => {
    // Timeout très court (50ms) pour l'effet "nerveux" 
    // mais suffisant pour traverser le pont invisible
    hoverTimeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
    }, 50);
  };

  const handlePopperEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const isHidden = annotationTemplate?.hidden;

  return (
    <Box ref={setNodeRef} style={style} sx={{ opacity: isDragging ? 0 : 1 }}>
      <ListItemButton
        onClick={(e) => onCreateClick(e, annotationTemplate)}
        divider
        onMouseEnter={handleListItemEnter}
        onMouseLeave={handleListItemLeave}
        sx={{
          position: "relative",
          bgcolor: "white",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 0.5,
          '&:hover': { bgcolor: 'action.hover' },
          // Optionnel : on peut aussi réduire légèrement l'opacité de toute la ligne
          // opacity: isHidden ? 0.6 : 1 
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: isDragging ? "grabbing" : "grab",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              // On grise l'icône si caché
              opacity: isHidden ? 0.4 : 1,
              filter: isHidden ? "grayscale(100%)" : "none",
            }}
          >
            <AnnotationIcon annotation={annotationTemplate} spriteImage={spriteImage} size={18} />
          </Box>
          <Typography
            sx={{ mx: 1 }}
            variant="body2"
            // On change la couleur du texte en gris clair si caché
            color={isHidden ? "text.disabled" : "text.primary"}
          >
            {annotationTemplate.label}
          </Typography>
        </Box>

        <Box sx={{ minWidth: "32px", display: "flex", justifyContent: "flex-end" }}>
          <Typography
            align="right"
            noWrap
            sx={{ fontSize: "12px" }}
            // On grise aussi le label de quantité
            color={isHidden ? "text.disabled" : (count > 0 ? "secondary.main" : "grey.200")}
          >
            {qtyLabel}
          </Typography>
        </Box>
      </ListItemButton>

      <Popper
        open={isOpen}
        anchorEl={anchorEl}
        placement="right"
        transition
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 16], // 16px d'écart avec la liste
            },
          },
        ]}
        style={{ zIndex: 1500 }}
        onMouseEnter={handlePopperEnter}
        onMouseLeave={handleListItemLeave}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={100}>
            <Paper
              elevation={6}
              sx={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 1.5,
                bgcolor: 'background.paper',
                position: 'relative',
                border: '1px solid',
                borderColor: 'divider',
                // PONT INVISIBLE pour éviter la coupure au survol
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: -18,
                  top: 0,
                  width: 18,
                  height: '100%',
                  bgcolor: 'transparent',
                },
                // LA PETITE FLÈCHE (Caret)
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: -5,
                  top: '50%',
                  transform: 'translateY(-50%) rotate(45deg)',
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  borderLeft: '1px solid',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }
              }}
            >
              <ToolbarCreateAnnotationFromTabAnnotationTemplates
                annotationTemplate={annotationTemplate}
              />
            </Paper>
          </Fade>
        )}
      </Popper>
    </Box>
  );
}

export default function SectionLocatedEntitiesInListPanelTabAnnotationTemplates() {
  const dispatch = useDispatch();
  const annotationTemplateCountById = useAnnotationTemplateCountById();
  const annotationTemplateQtiesById = useAnnotationTemplateQtiesById();
  const annotationTemplates = useAnnotationTemplatesBySelectedListing({ sortByLabel: true });
  const spriteImage = useAnnotationSpriteImage();
  const [activeDraggedTemplate, setActiveDraggedTemplate] = useState(null);

  useDndMonitor({
    onDragStart(event) {
      const activeData = event.active.data.current;
      if (activeData?.type === "annotationTemplate") {
        const template = annotationTemplates?.find(t => t.id === activeData.annotationTemplateId);
        setActiveDraggedTemplate(template);
      }
    },
    onDragEnd() { setActiveDraggedTemplate(null); },
    onDragCancel() { setActiveDraggedTemplate(null); },
  });

  function handleCreateClick(e, annotationTemplate) {
    dispatch(setSelectedItem({ id: annotationTemplate?.id, type: "ANNOTATION_TEMPLATE" }));

    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"))
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 1 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <IconButtonAnnotationTemplatesDownload />
          <IconButtonAnnotationTemplatesUpload />
        </Box>
        <IconButtonActionCreateAnnotationTemplate />
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List>
          {annotationTemplates?.map((annotationTemplate, idx) => {
            const count = annotationTemplateCountById?.[annotationTemplate.id] || 0;
            const qtyLabel = annotationTemplateQtiesById?.[annotationTemplate.id]?.mainQtyLabel;

            if (!annotationTemplate?.isDivider)
              return (
                <DraggableAnnotationTemplateItem
                  key={annotationTemplate.id}
                  annotationTemplate={annotationTemplate}
                  count={count}
                  qtyLabel={qtyLabel}
                  spriteImage={spriteImage}
                  onCreateClick={handleCreateClick}
                />
              );
            if (annotationTemplate?.isDivider && idx !== 0)
              return <Box key={idx} sx={{ my: 1 }} />;
            return null;
          })}
        </List>
      </BoxFlexVStretch>

      <DragOverlay>
        {activeDraggedTemplate && (
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AnnotationIcon annotation={activeDraggedTemplate} spriteImage={spriteImage} size={24} />
          </Box>
        )}
      </DragOverlay>
    </BoxFlexVStretch>
  );
}