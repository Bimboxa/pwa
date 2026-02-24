import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";
import { selectSelectedItems } from "Features/selection/selectionSlice";

import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
} from "@mui/material";
import { Add, Delete } from "@mui/icons-material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
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

import db from "App/db/db";

function SortablePageRow({ page, isSelected, onClick }) {
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
      sx={{ pl: 4, py: 0.25, ...style }}
    >
      <ListItemText
        primary={page.title}
        primaryTypographyProps={{
          variant: "body2",
          fontWeight: isSelected ? "bold" : "normal",
        }}
      />
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
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: portfolio.id,
  });
  const createPage = useCreatePortfolioPage();

  // state

  const [activeId, setActiveId] = useState(null);

  // helpers

  const isDisplayed = displayedPortfolioId === portfolio.id;
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

  function handlePortfolioClick() {
    dispatch(setDisplayedPortfolioId(portfolio.id));
    dispatch(
      setSelectedItem({ id: portfolio.id, type: "PORTFOLIO" })
    );
  }

  function handlePageClick(page) {
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
      portfolioId: portfolio.id,
      scopeId,
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
    await db.portfolioPages.delete(pageId);
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id || !pages) return;

    const oldIndex = pageIds.indexOf(active.id);
    const newIndex = pageIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const before = newIndex > 0 ? pages[newIndex - 1]?.sortIndex : null;
    const after =
      newIndex < pages.length - 1 ? pages[newIndex + 1]?.sortIndex : null;

    // If moving down, use current item at newIndex as "before"
    // If moving up, use current item at newIndex as "after"
    let newSortIndex;
    if (oldIndex < newIndex) {
      const b = pages[newIndex]?.sortIndex ?? null;
      const a = newIndex + 1 < pages.length ? pages[newIndex + 1]?.sortIndex : null;
      newSortIndex = generateKeyBetween(b, a);
    } else {
      const b = newIndex > 0 ? pages[newIndex - 1]?.sortIndex : null;
      const a = pages[newIndex]?.sortIndex ?? null;
      newSortIndex = generateKeyBetween(b, a);
    }

    await db.portfolioPages.update(active.id, { sortIndex: newSortIndex });
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  const activePage = useMemo(
    () => pages?.find((p) => p.id === activeId),
    [pages, activeId]
  );

  // render

  return (
    <Box>
      <ListItemButton
        selected={isPortfolioSelected}
        onClick={handlePortfolioClick}
        sx={{ py: 0.5 }}
      >
        <ListItemText
          primary={portfolio.title}
          primaryTypographyProps={{
            variant: "body2",
            fontWeight: isDisplayed ? "bold" : "normal",
          }}
        />
      </ListItemButton>

      {isDisplayed && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
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
                  />
                );
              })}
            </List>
          </SortableContext>

          <DragOverlay>
            {activePage ? (
              <ListItemButton component="div" selected sx={{ pl: 4, py: 0.25 }}>
                <ListItemText
                  primary={activePage.title}
                  primaryTypographyProps={{ variant: "body2" }}
                />
              </ListItemButton>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {isDisplayed && (
        <ListItemButton sx={{ pl: 4, py: 0.25 }} onClick={handleAddPage}>
          <Typography variant="body2" color="text.secondary">
            + Nouvelle page
          </Typography>
        </ListItemButton>
      )}
    </Box>
  );
}
