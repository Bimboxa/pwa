import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setStatusFilter } from "../businessObjectsSlice";

import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";

import useBusinessObjects from "../hooks/useBusinessObjects";
import useMoveBusinessObject from "../hooks/useMoveBusinessObject";
import useBusinessObjectQties from "../hooks/useBusinessObjectQties";
import useBusinessObjectsListCard from "../hooks/useBusinessObjectsListCard";
import useRelsBusinessObjectResource from "../hooks/useRelsBusinessObjectResource";
import sortDocumentRels from "../utils/sortDocumentRels";
import useTaskPlanningProgress from "Features/planning/hooks/useTaskPlanningProgress";
import buildBusinessObjectsTree, {
  getBusinessObjectDescendants,
  getBusinessObjectsTreeDisplayMeta,
} from "../utils/buildBusinessObjectsTree";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import selectSelectedBusinessObjectId from "../utils/selectSelectedBusinessObjectId";
import { isBusinessObjectClosed } from "../utils/getBusinessObjectStatus";
import { getHoursBudgetByObjectId } from "../utils/getBusinessObjectHoursBudget";
import { formatHours } from "../utils/hoursRatioConversions";

import BusinessObjectTreeItem from "./BusinessObjectTreeItem";
import DialogBusinessObjectForm from "./DialogBusinessObjectForm";

// Objects tree of the selected business-objects listing: dnd reorder /
// reparent (drop rule + cycle guard cloned from the zonings tree), per-row
// quantities from the linked annotations. PLANNING listings (type feature
// hoursBudget) add the rolled-up hours per row and a total band. With the
// listing setting `listCard` (Krnet "Aperçu de l'objet"), the object rows
// render the configured avatar + primary + secondary texts instead.
// Types with a status (ISSUE, type feature status) get an "Ouverts / Tous"
// filter band: "Ouverts" hides the closed objects, except the ancestors of a
// displayed row and the selected / active object (a row never vanishes under
// the pointer when its checkbox is ticked).
// `readOnly` (Viewer module): no creation, no dnd, no edition / linking
// actions on the rows.
export default function BusinessObjectsTree({ listing, readOnly = false }) {
  const dispatch = useDispatch();

  // strings

  const openS = "Ouverts";
  const allS = "Tous";

  // data

  const type = getBusinessObjectTypeOfListing(listing);
  const hasHoursBudget = Boolean(type.features?.hoursBudget);
  // PLANNING listings: per-task planned / done share over the work packages
  const hasWorkPackages = Boolean(type.features?.workPackages);
  const planningProgress = useTaskPlanningProgress({
    listingId: hasWorkPackages ? listing.id : null,
  });

  const { value: businessObjects } = useBusinessObjects({
    listingId: listing.id,
  });
  const moveBusinessObject = useMoveBusinessObject();
  const collapsedIds = useSelector((s) => s.businessObjects.collapsedIds);
  const hasStatus = Boolean(type.features?.status);
  const statusFilter = useSelector((s) => s.businessObjects.statusFilter);
  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const listCard = useBusinessObjectsListCard({ listing, businessObjects });

  const {
    qtiesByObjectId,
    annotationsByObjectId,
    mainRelsByObjectId,
    mainAnnotationsByObjectId,
  } = useBusinessObjectQties({
    listingId: listing.id,
  });

  // Links to highlighted zones of PDF documents, in reading order.
  const { value: documentRels } = useRelsBusinessObjectResource({
    listingId: listing.id,
  });
  const documentRelsByObjectId = useMemo(() => {
    const byObjectId = {};
    sortDocumentRels(documentRels).forEach((rel) => {
      (byObjectId[rel.businessObjectId] ??= []).push(rel);
    });
    return byObjectId;
  }, [documentRels]);

  // Solo target of a row click: the object's own linked annotations + its
  // descendants' (the row display keeps the own-only counts — no hierarchical
  // aggregation). Memoized bottom-up with a cycle guard.
  const soloAnnotationsByObjectId = useMemo(() => {
    const childrenByParentId = {};
    (businessObjects ?? []).forEach((o) => {
      const key = o.parentId ?? "ROOT";
      if (!childrenByParentId[key]) childrenByParentId[key] = [];
      childrenByParentId[key].push(o);
    });
    const byId = {};
    const collect = (id) => {
      if (byId[id]) return byId[id];
      byId[id] = []; // cycle guard
      const own = annotationsByObjectId[id] ?? [];
      const childAnnotations = (childrenByParentId[id] ?? []).flatMap((c) =>
        collect(c.id)
      );
      byId[id] = [...own, ...childAnnotations];
      return byId[id];
    };
    (businessObjects ?? []).forEach((o) => collect(o.id));
    return byId;
  }, [businessObjects, annotationsByObjectId]);

  // Hours budget per task (own + descendants) and listing total — tasks only.
  const hoursBudget = useMemo(
    () =>
      hasHoursBudget
        ? getHoursBudgetByObjectId(businessObjects ?? [], qtiesByObjectId)
        : null,
    [hasHoursBudget, businessObjects, qtiesByObjectId]
  );

  // state

  // {parentBusinessObject} | null — object creation dialog target
  const [createTarget, setCreateTarget] = useState(null);

  // helpers

  const flatTree = useMemo(
    () => buildBusinessObjectsTree(businessObjects),
    [businessObjects]
  );
  const flatIds = useMemo(
    () => flatTree.map(({ businessObject }) => businessObject.id),
    [flatTree]
  );

  // Listing with codes (stored `code` of the objects — imported, typed or
  // written by "Renuméroter"): 3-column DPGF-like rendering (code / label /
  // quantity). The level metadata is computed on the FULL tree.
  const showCodes = useMemo(
    () => (businessObjects ?? []).some((o) => Boolean(o.code)),
    [businessObjects]
  );
  const displayMetaById = useMemo(() => {
    const metas = getBusinessObjectsTreeDisplayMeta(flatTree);
    const byId = {};
    flatTree.forEach(({ businessObject }, i) => {
      byId[businessObject.id] = metas[i];
    });
    return byId;
  }, [flatTree]);
  const parentIds = useMemo(
    () =>
      new Set((businessObjects ?? []).map((o) => o.parentId).filter(Boolean)),
    [businessObjects]
  );

  // Status filter "Ouverts": ids of the rows kept — the open objects, the
  // selected / active one, and their ancestors (a closed parent of a kept
  // row stays, greyed). null = no filtering.
  const openCount = useMemo(
    () =>
      (businessObjects ?? []).filter((o) => !isBusinessObjectClosed(o)).length,
    [businessObjects]
  );
  const keptIds = useMemo(() => {
    if (!hasStatus || statusFilter !== "OPEN") return null;
    const byId = {};
    (businessObjects ?? []).forEach((o) => {
      byId[o.id] = o;
    });
    const kept = new Set();
    const keepWithAncestors = (object) => {
      let current = object;
      // cycle guard: a kept id stops the walk
      while (current && !kept.has(current.id)) {
        kept.add(current.id);
        current = current.parentId ? byId[current.parentId] : null;
      }
    };
    (businessObjects ?? []).forEach((o) => {
      if (
        !isBusinessObjectClosed(o) ||
        o.id === selectedBusinessObjectId ||
        o.id === activeBusinessObjectId
      )
        keepWithAncestors(o);
    });
    return kept;
  }, [
    hasStatus,
    statusFilter,
    businessObjects,
    selectedBusinessObjectId,
    activeBusinessObjectId,
  ]);

  // Hide the rows whose any ancestor is collapsed (the flat tree is
  // depth-first: a collapsed node at depth d hides the following rows with
  // depth > d until a row at depth <= d shows up), and the rows filtered out
  // by the status filter (a filtered-out row has no kept descendant).
  const visibleTree = useMemo(() => {
    const visible = [];
    let hiddenBelowDepth = null;
    flatTree.forEach(({ businessObject, depth }) => {
      if (hiddenBelowDepth != null && depth > hiddenBelowDepth) return;
      hiddenBelowDepth = null;
      if (keptIds && !keptIds.has(businessObject.id)) return;
      visible.push({ businessObject, depth });
      if (collapsedIds.includes(businessObject.id)) hiddenBelowDepth = depth;
    });
    return visible;
  }, [flatTree, collapsedIds, keptIds]);

  // objects exist but the status filter hides them all
  const emptyS =
    flatTree.length > 0 ? `${type.strings.empty} ouvert` : type.strings.empty;

  // dnd — 5px activation so plain clicks keep selecting the object
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // handlers

  function handleStatusFilterChange(_e, value) {
    if (value) dispatch(setStatusFilter(value));
  }

  // Drop rule (zonings clone): the dragged object lands next to the hovered
  // one, adopting its parent. The new fractional sortIndex slots it
  // before/after the target among the target's siblings, depending on the
  // drag direction.
  async function handleDragEnd({ active, over }) {
    if (readOnly) return;
    if (!over || active.id === over.id) return;
    const dragged = businessObjects?.find((o) => o.id === active.id);
    const target = businessObjects?.find((o) => o.id === over.id);
    if (!dragged || !target) return;

    // cycle guard: never drop an object into its own subtree
    const descendants = getBusinessObjectDescendants(
      businessObjects,
      dragged.id
    );
    if (descendants.some((d) => d.id === target.id)) return;

    const movingDown = flatIds.indexOf(active.id) < flatIds.indexOf(over.id);

    const targetParentId = target.parentId ?? null;
    const siblings = businessObjects
      .filter(
        (o) => (o.parentId ?? null) === targetParentId && o.id !== dragged.id
      )
      .sort((a, b) =>
        String(a.sortIndex ?? "").localeCompare(String(b.sortIndex ?? ""))
      );
    const targetIdx = siblings.findIndex((o) => o.id === target.id);
    if (targetIdx === -1) return;

    let sortIndex;
    try {
      if (movingDown) {
        const next = siblings[targetIdx + 1];
        sortIndex = generateKeyBetween(
          target.sortIndex ?? null,
          next?.sortIndex ?? null
        );
      } else {
        const prev = siblings[targetIdx - 1];
        sortIndex = generateKeyBetween(
          prev?.sortIndex ?? null,
          target.sortIndex ?? null
        );
      }
    } catch (e) {
      console.warn("[BusinessObjectsTree] sortIndex generation failed", e);
      return;
    }

    await moveBusinessObject(dragged.id, {
      parentId: targetParentId,
      sortIndex,
    });
  }

  // render

  return (
    <Box sx={{ p: 1 }}>
      {hasStatus && (
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={statusFilter}
          onChange={handleStatusFilterChange}
          sx={{ mb: 1, "& .MuiToggleButton-root": { py: 0.25 } }}
        >
          <ToggleButton value="OPEN" sx={{ textTransform: "none" }}>
            {`${openS} (${openCount})`}
          </ToggleButton>
          <ToggleButton value="ALL" sx={{ textTransform: "none" }}>
            {`${allS} (${flatTree.length})`}
          </ToggleButton>
        </ToggleButtonGroup>
      )}
      <DndContext
        id={`business-objects-dnd-${listing.id}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
          <List dense disablePadding>
            {visibleTree.map(({ businessObject, depth }) => (
              <BusinessObjectTreeItem
                key={businessObject.id}
                businessObject={businessObject}
                depth={depth}
                hasChildren={parentIds.has(businessObject.id)}
                listing={listing}
                readOnly={readOnly}
                showCodes={showCodes}
                card={
                  listCard && !businessObject.isTitle
                    ? listCard.getCard(businessObject)
                    : null
                }
                displayMeta={displayMetaById[businessObject.id]}
                qties={qtiesByObjectId[businessObject.id]}
                linkedAnnotations={annotationsByObjectId[businessObject.id]}
                soloAnnotations={soloAnnotationsByObjectId[businessObject.id]}
                mainRels={mainRelsByObjectId[businessObject.id]}
                documentRels={documentRelsByObjectId[businessObject.id]}
                mainAnnotations={mainAnnotationsByObjectId[businessObject.id]}
                hoursBudget={hoursBudget?.totalById[businessObject.id] ?? null}
                planningProgress={
                  planningProgress.byTaskId[businessObject.id] ?? null
                }
                onAddChildBusinessObject={() =>
                  setCreateTarget({ parentBusinessObject: businessObject })
                }
              />
            ))}
            {visibleTree.length === 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ pl: 2, py: 0.5, display: "block" }}
              >
                {emptyS}
              </Typography>
            )}
          </List>
        </SortableContext>
      </DndContext>

      {!readOnly && (
        <ListItemButton
          onClick={() => setCreateTarget({ parentBusinessObject: null })}
          sx={{ pl: 2, color: "text.disabled" }}
        >
          <Add sx={{ fontSize: 20, mr: 1 }} color="disabled" />
          <ListItemText
            primary={type.strings.newObject}
            slotProps={{
              primary: { variant: "body2", color: "text.disabled" },
            }}
          />
        </ListItemButton>
      )}

      {/* listing total of the hours budget — sticky at the bottom of the
          panel's scroll area (the negative margins cancel the root padding) */}
      {hasHoursBudget && (
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            mx: -1,
            mb: -1,
            px: 2,
            py: 0.75,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bgcolor: "panel.sectionBg",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Total
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatHours(hoursBudget?.grandTotal ?? 0)}
          </Typography>
        </Box>
      )}

      {!readOnly && createTarget && (
        <DialogBusinessObjectForm
          open
          listing={listing}
          parentBusinessObject={createTarget.parentBusinessObject}
          onClose={() => setCreateTarget(null)}
        />
      )}
    </Box>
  );
}
