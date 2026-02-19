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
  IconButton,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

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
import useUpdateAnnotationTemplate from "Features/annotations/hooks/useUpdateAnnotationTemplate";

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

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const [anchorEl, setAnchorEl] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const isOpen = Boolean(anchorEl);

  const handleListItemEnter = (event) => {
    setIsHovered(true);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setAnchorEl(event.currentTarget);
  };

  const handleListItemLeave = () => {
    setIsHovered(false);
    hoverTimeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
    }, 50);
  };

  const handlePopperEnter = () => {
    setIsHovered(true);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  };

  const handleToggleHidden = async (e) => {
    e.stopPropagation(); // Évite de déclencher le clic de création sur la ligne
    await updateAnnotationTemplate({
      ...annotationTemplate,
      hidden: !annotationTemplate?.hidden
    });
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
          py: 0.25,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
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
              opacity: isHidden ? 0.4 : 1,
              filter: isHidden ? "grayscale(100%)" : "none",
              mr: 1
            }}
          >
            <AnnotationIcon annotation={annotationTemplate} spriteImage={spriteImage} size={18} />
          </Box>
          <Typography
            variant="body2"
            noWrap
            color={isHidden ? "text.disabled" : "text.primary"}
          >
            {annotationTemplate.label}
          </Typography>
        </Box>

        {/* Zone de permutation : Qté <-> Visibilité */}
        <Box sx={{ minWidth: "40px", display: "flex", justifyContent: "flex-end", alignItems: "center", ml: 1 }}>
          {isHovered ? (
            <IconButton
              size="small"
              onClick={handleToggleHidden}
              sx={{ p: 0.5 }}
            >
              {isHidden ? (
                <VisibilityOff fontSize="inherit" sx={{ fontSize: 16 }} />
              ) : (
                <Visibility fontSize="inherit" sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          ) : (
            <Typography
              align="right"
              noWrap
              sx={{ fontSize: "12px" }}
              color={isHidden ? "text.disabled" : (count > 0 ? "secondary.main" : "grey.200")}
            >
              {qtyLabel}
            </Typography>
          )}
        </Box>
      </ListItemButton>

      <Popper
        open={isOpen}
        anchorEl={anchorEl}
        placement="right"
        transition
        modifiers={[{ name: 'offset', options: { offset: [0, 16] } }]}
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
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: -18,
                  top: 0,
                  width: 18,
                  height: '100%',
                  bgcolor: 'transparent',
                },
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

// Le reste du composant (SectionLocatedEntitiesInListPanelTabAnnotationTemplates) reste identique à votre base.
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
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
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