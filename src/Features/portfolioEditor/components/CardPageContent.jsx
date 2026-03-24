import { useMemo, useState } from "react";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
} from "@mui/material";
import {
  Map as MapIcon,
  Image as ImageIcon,
  Article as ArticleIcon,
  DragIndicator,
  Add as AddIcon,
} from "@mui/icons-material";

import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";

import useDndSensors from "App/hooks/useDndSensors";
import db from "App/db/db";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useCreatePortfolioBaseMapContainer from "Features/portfolioBaseMapContainers/hooks/useCreatePortfolioBaseMapContainer";
import BaseMapSelectorPopover from "./BaseMapSelectorPopover";

import getPageLayout from "../utils/getPageLayout";
import fitContainerToBaseMap from "../utils/fitContainerToBaseMap";

const ICON_BY_TYPE = {
  BASE_MAP_CONTAINER: MapIcon,
  IMAGE: ImageIcon,
};

const TABLE_BY_TYPE = {
  BASE_MAP_CONTAINER: "portfolioBaseMapContainers",
};

function SortableContentRow({ item }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = ICON_BY_TYPE[item.type] || ArticleIcon;

  return (
    <ListItemButton
      ref={setNodeRef}
      {...attributes}
      component="div"
      sx={{ py: 0.5, px: 2, ...style }}
    >
      <ListItemIcon
        {...listeners}
        sx={{ minWidth: 24, mr: 0.5, cursor: "grab" }}
      >
        <DragIndicator fontSize="small" sx={{ opacity: 0.4 }} />
      </ListItemIcon>
      <ListItemIcon sx={{ minWidth: 32 }}>
        <Icon fontSize="small" sx={{ opacity: 0.6 }} />
      </ListItemIcon>
      <ListItemText
        primary={item.label}
        slotProps={{
          primary: { variant: "body2", noWrap: true },
        }}
      />
    </ListItemButton>
  );
}

export default function CardPageContent({ content, page }) {
  // data

  const sensors = useDndSensors();
  const itemIds = useMemo(
    () => (content || []).map((item) => item.id),
    [content]
  );
  const { value: portfolio } = useDisplayedPortfolio();
  const createContainer = useCreatePortfolioBaseMapContainer();

  // state

  const [popoverAnchorEl, setPopoverAnchorEl] = useState(null);

  // handlers

  function handleAddClick(e) {
    setPopoverAnchorEl(e.currentTarget);
  }

  function handlePopoverClose() {
    setPopoverAnchorEl(null);
  }

  async function handleSelectBaseMap(baseMap) {
    if (!page || !portfolio) return;

    const lastSortIndex = content?.length
      ? content[content.length - 1].sortIndex
      : null;

    const footerHeight = portfolio?.metadata?.footerHeight || 0;
    const layout = getPageLayout(page.format, page.orientation, footerHeight);
    const contentArea = layout.contentArea;

    const imageSize = baseMap.getImageSize();
    let x = contentArea.x;
    let y = contentArea.y;
    let width = contentArea.width;
    let height = contentArea.height;

    if (imageSize) {
      const fitted = fitContainerToBaseMap(imageSize, contentArea);
      x = fitted.x;
      y = fitted.y;
      width = fitted.width;
      height = fitted.height;
    }

    const container = await createContainer({
      portfolioPageId: page.id,
      scopeId: portfolio.scopeId,
      projectId: portfolio.projectId,
      baseMapId: baseMap.id,
      x,
      y,
      width,
      height,
      afterSortIndex: lastSortIndex,
    });

    if (imageSize) {
      await db.portfolioBaseMapContainers.update(container.id, {
        viewBox: {
          x: 0,
          y: 0,
          width: imageSize.width,
          height: imageSize.height,
        },
      });
    }

    handlePopoverClose();
  }

  async function handleCreateBaseMap() {
    if (!page || !portfolio) return;

    const lastSortIndex = content?.length
      ? content[content.length - 1].sortIndex
      : null;

    const footerHeight = portfolio?.metadata?.footerHeight || 0;
    const layout = getPageLayout(page.format, page.orientation, footerHeight);
    const contentArea = layout.contentArea;

    await createContainer({
      portfolioPageId: page.id,
      scopeId: portfolio.scopeId,
      projectId: portfolio.projectId,
      x: contentArea.x,
      y: contentArea.y,
      width: contentArea.width,
      height: contentArea.height,
      afterSortIndex: lastSortIndex,
    });

    handlePopoverClose();
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !content?.length) return;

    const oldIndex = itemIds.indexOf(active.id);
    const newIndex = itemIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const item = content[oldIndex];
    const tableName = TABLE_BY_TYPE[item.type];
    if (!tableName) return;

    let newSortIndex;
    if (oldIndex < newIndex) {
      const b = content[newIndex]?.sortIndex ?? null;
      const a =
        newIndex + 1 < content.length
          ? content[newIndex + 1]?.sortIndex
          : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b =
        newIndex > 0 ? content[newIndex - 1]?.sortIndex : null;
      const a = content[newIndex]?.sortIndex ?? null;
      newSortIndex = generateKeyBetween(b, a);
    }

    await db[tableName].update(active.id, { sortIndex: newSortIndex });
  }

  // render

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Contenu
        </Typography>
        <IconButton
          size="small"
          onClick={handleAddClick}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>

      {!content?.length ? (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Page blanche
          </Typography>
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={itemIds}
            strategy={verticalListSortingStrategy}
          >
            <List dense disablePadding>
              {content.map((item) => (
                <SortableContentRow key={item.id} item={item} />
              ))}
            </List>
          </SortableContext>
        </DndContext>
      )}

      <BaseMapSelectorPopover
        anchorEl={popoverAnchorEl}
        open={Boolean(popoverAnchorEl)}
        onClose={handlePopoverClose}
        onSelectBaseMap={handleSelectBaseMap}
        onCreateBaseMap={handleCreateBaseMap}
      />
    </Box>
  );
}
