import { useState, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import {
  Box,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Typography,
} from "@mui/material";
import {
  Add as AddIcon,
  Check,
  Close,
  DragIndicator,
} from "@mui/icons-material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { generateKeyBetween } from "fractional-indexing";

import IconButtonMoreActionsPortfolioPage from "./IconButtonMoreActionsPortfolioPage";

import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";
import useAddPortfolioPage from "Features/portfolioPages/hooks/useAddPortfolioPage";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

// ---------------------------------------------------------------------------
// SectionPortfolioPages — the sortable pages list of one portfolio: drag to
// reorder (fractional sortIndex), click to select (the viewport scrolls to
// the page), inline rename, per-page "⋮" menu. Hosted by the left panel tree
// (PortfolioTreeItem) and by the floating manager (PopperPortfolioManager,
// with the trailing "Nouvelle page" row).
// ---------------------------------------------------------------------------

function SortablePageRow({
  page,
  portfolio,
  indent,
  isSelected,
  onClick,
  isEditing,
  tempTitle,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onTempTitleChange,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ListItemButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      component="div"
      onClick={onClick}
      sx={{
        pl: indent,
        ...style,
        borderLeft: "3px solid",
        borderLeftColor: isSelected ? "secondary.main" : "transparent",
      }}
    >
      <DragIndicator
        className="row-drag-handle"
        sx={{
          fontSize: 14,
          color: "text.disabled",
          cursor: "grab",
          ml: -1.5,
          mr: 0.5,
        }}
      />
      {isEditing ? (
        <InputBase
          value={tempTitle}
          onChange={(e) => onTempTitleChange(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") onConfirmEdit();
            else if (e.key === "Escape") onCancelEdit();
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          sx={{ fontSize: "0.875rem", flex: 1 }}
        />
      ) : (
        <ListItemText
          primary={page.title}
          sx={{ minWidth: 0 }}
          slotProps={{
            primary: {
              variant: "body2",
              noWrap: true,
              fontWeight: isSelected ? "bold" : "normal",
            },
          }}
        />
      )}
      {isEditing ? (
        <Box sx={{ display: "flex", ml: 1 }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmEdit();
            }}
            sx={{ color: "success.main" }}
          >
            <Check fontSize="inherit" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onCancelEdit();
            }}
            sx={{ color: "error.main" }}
          >
            <Close fontSize="inherit" />
          </IconButton>
        </Box>
      ) : (
        <IconButtonMoreActionsPortfolioPage
          page={page}
          portfolio={portfolio}
          onRename={onStartEdit}
          size="small"
          sx={{ p: 0.25, color: "text.disabled" }}
        />
      )}
    </ListItemButton>
  );
}

export default function SectionPortfolioPages({
  portfolio,
  indent = 5,
  showAddPageRow = false,
  dndIdSuffix = "",
}) {
  const dispatch = useDispatch();

  // strings

  const newPageS = "Nouvelle page";

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: portfolio?.id,
  });
  const addPage = useAddPortfolioPage({ portfolio, pages });
  const updateEntity = useUpdateEntity();

  // state

  const [editingPageId, setEditingPageId] = useState(null);
  const [tempTitle, setTempTitle] = useState("");

  // helpers

  const pageIds = useMemo(() => (pages || []).map((p) => p.id), [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // handlers

  function handlePageClick(page) {
    if (editingPageId === page.id) return;
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: portfolio.id,
      })
    );
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id || !pages) return;

    const oldIndex = pageIds.indexOf(active.id);
    const newIndex = pageIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    let newSortIndex;
    if (oldIndex < newIndex) {
      const b = pages[newIndex]?.sortIndex ?? null;
      const a =
        newIndex + 1 < pages.length ? pages[newIndex + 1]?.sortIndex : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b = newIndex > 0 ? pages[newIndex - 1]?.sortIndex : null;
      const a = pages[newIndex]?.sortIndex ?? null;
      newSortIndex = generateKeyBetween(b, a);
    }

    await updateEntity(
      active.id,
      { sortIndex: newSortIndex },
      { listing: portfolio }
    );
  }

  // handlers - edit title

  function handleStartEditPage(page) {
    setEditingPageId(page.id);
    setTempTitle(page.title);
  }

  async function handleConfirmEditPage(pageId) {
    await updateEntity(pageId, { title: tempTitle }, { listing: portfolio });
    setEditingPageId(null);
  }

  function handleCancelEdit() {
    setEditingPageId(null);
  }

  // render

  if (!portfolio) return null;

  return (
    <>
      <DndContext
        id={`portfolio-pages-dnd-${portfolio.id}${dndIdSuffix}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pageIds} strategy={verticalListSortingStrategy}>
          <List dense disablePadding>
            {pages?.map((page) => {
              const isPageSelected = selectedItems.some(
                (i) => i.id === page.id && i.type === "PORTFOLIO_PAGE"
              );
              return (
                <SortablePageRow
                  key={page.id}
                  page={page}
                  portfolio={portfolio}
                  indent={indent}
                  isSelected={isPageSelected}
                  onClick={() => handlePageClick(page)}
                  isEditing={editingPageId === page.id}
                  tempTitle={tempTitle}
                  onStartEdit={() => handleStartEditPage(page)}
                  onConfirmEdit={() => handleConfirmEditPage(page.id)}
                  onCancelEdit={handleCancelEdit}
                  onTempTitleChange={setTempTitle}
                />
              );
            })}
          </List>
        </SortableContext>
      </DndContext>

      {showAddPageRow && (
        <ListItemButton
          onClick={addPage}
          sx={{
            pl: indent,
            pr: 1,
            py: 0.5,
            alignItems: "center",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 18,
              height: 18,
              mr: 1,
              border: "1.5px dashed",
              borderColor: "panel.textLight",
              borderRadius: 0.5,
            }}
          >
            <AddIcon sx={{ fontSize: 12, color: "panel.textLight" }} />
          </Box>
          <Typography variant="body2" color="panel.textLight">
            {newPageS}
          </Typography>
        </ListItemButton>
      )}
    </>
  );
}
