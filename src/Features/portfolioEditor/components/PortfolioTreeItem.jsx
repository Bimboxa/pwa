import { useState, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";
import { togglePortfolioCollapsed } from "Features/portfolios/portfoliosSlice";

import {
  Box,
  Divider,
  InputBase,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
} from "@mui/material";
import { Add, Remove, Edit, Check, Close } from "@mui/icons-material";

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

import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";
import useCreatePortfolioPage from "Features/portfolioPages/hooks/useCreatePortfolioPage";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import db from "App/db/db";

function SortablePageRow({
  page,
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
      selected={isSelected}
      onClick={onClick}
      sx={{
        pl: 4,
        ...style,
        "&:hover .edit-icon": { opacity: 1 },
      }}
    >
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
          slotProps={{
            primary: {
              variant: "body2",
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
        <IconButton
          size="small"
          className="edit-icon"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          sx={{ opacity: 0, transition: "0.2s" }}
        >
          <Edit fontSize="inherit" />
        </IconButton>
      )}
    </ListItemButton>
  );
}

export default function PortfolioTreeItem({ portfolio }) {
  const dispatch = useDispatch();

  // data

  const selectedItems = useSelector(selectSelectedItems);
  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const collapsedPortfolioIds = useSelector(
    (s) => s.portfolios.collapsedPortfolioIds
  );
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: portfolio.id,
  });
  const createPage = useCreatePortfolioPage();
  const updateEntity = useUpdateEntity();

  // state

  const [editingItemId, setEditingItemId] = useState(null);
  const [tempTitle, setTempTitle] = useState("");

  // helpers

  const isDisplayed = displayedPortfolioId === portfolio.id;
  const isExpanded = !collapsedPortfolioIds.includes(portfolio.id);
  const isPortfolioSelected = selectedItems.some(
    (i) => i.id === portfolio.id && i.type === "PORTFOLIO"
  );
  const pageIds = useMemo(() => (pages || []).map((p) => p.id), [pages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // handlers

  function handleToggleCollapsed(e) {
    e.stopPropagation();
    dispatch(togglePortfolioCollapsed(portfolio.id));
  }

  function handlePortfolioClick() {
    if (editingItemId === portfolio.id) return;
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(setSelectedItem({ id: portfolio.id, type: "PORTFOLIO" }));
  }

  function handlePageClick(page) {
    if (editingItemId === page.id) return;
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: portfolio.id,
      })
    );
  }

  async function handleAddPage() {
    const lastPage = pages?.[pages.length - 1];
    const page = await createPage({
      listing: portfolio,
      projectId,
      title: `Page ${(pages?.length || 0) + 1}`,
      afterSortIndex: lastPage?.sortIndex ?? null,
    });
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_PAGE",
        portfolioId: portfolio.id,
      })
    );
  }

  async function handleDeletePage(e, pageId) {
    e.stopPropagation();
    await db.portfolioPages.delete(pageId); // TODO: container cascade handled elsewhere
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

    await updateEntity(active.id, { sortIndex: newSortIndex }, { listing: portfolio });
  }

  // handlers - edit title

  function handleStartEditPortfolio(e) {
    e.stopPropagation();
    setEditingItemId(portfolio.id);
    setTempTitle(portfolio.name);
  }

  async function handleConfirmEditPortfolio() {
    await db.listings.update(portfolio.id, { name: tempTitle });
    setEditingItemId(null);
  }

  function handleStartEditPage(page) {
    setEditingItemId(page.id);
    setTempTitle(page.title);
  }

  async function handleConfirmEditPage(pageId) {
    await updateEntity(pageId, { title: tempTitle }, { listing: portfolio });
    setEditingItemId(null);
  }

  function handleCancelEdit() {
    setEditingItemId(null);
  }

  // render

  const isEditingPortfolio = editingItemId === portfolio.id;

  return (
    <Box sx={{ mb: 1 }}>
      <ListItemButton
        selected={isPortfolioSelected}
        onClick={handlePortfolioClick}
        sx={{
          pl: 1,
          "&:hover .edit-icon": { opacity: 1 },
        }}
      >
        <IconButton
          size="small"
          color="secondary"
          onClick={handleToggleCollapsed}
          sx={{ mr: 1, p: 0 }}
        >
          {isExpanded ? (
            <Remove fontSize="small" />
          ) : (
            <Add fontSize="small" />
          )}
        </IconButton>
        {isEditingPortfolio ? (
          <InputBase
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") handleConfirmEditPortfolio();
              else if (e.key === "Escape") handleCancelEdit();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            sx={{ fontSize: "0.875rem", flex: 1 }}
          />
        ) : (
          <ListItemText
            primary={portfolio.name}
            slotProps={{
              primary: {
                variant: "body2",
                fontWeight: isDisplayed ? "bold" : "normal",
              },
            }}
          />
        )}
        {isEditingPortfolio ? (
          <Box sx={{ display: "flex", ml: 1 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmEditPortfolio();
              }}
              sx={{ color: "success.main" }}
            >
              <Check fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelEdit();
              }}
              sx={{ color: "error.main" }}
            >
              <Close fontSize="inherit" />
            </IconButton>
          </Box>
        ) : (
          <IconButton
            size="small"
            className="edit-icon"
            onClick={handleStartEditPortfolio}
            sx={{ opacity: 0, transition: "0.2s" }}
          >
            <Edit fontSize="inherit" />
          </IconButton>
        )}
      </ListItemButton>

      {isExpanded && (
        <>
          <Divider />
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pageIds}
              strategy={verticalListSortingStrategy}
            >
              <List dense disablePadding>
                {pages?.map((page) => {
                  const isPageSelected = selectedItems.some(
                    (i) => i.id === page.id && i.type === "PORTFOLIO_PAGE"
                  );
                  return (
                    <SortablePageRow
                      key={page.id}
                      page={page}
                      isSelected={isPageSelected}
                      onClick={() => handlePageClick(page)}
                      isEditing={editingItemId === page.id}
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

          <ListItemButton sx={{ pl: 4 }} onClick={handleAddPage}>
            <Typography variant="body2" color="text.secondary">
              + Nouvelle page
            </Typography>
          </ListItemButton>
        </>
      )}
    </Box>
  );
}
