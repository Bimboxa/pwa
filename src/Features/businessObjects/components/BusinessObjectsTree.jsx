import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { Box, List, ListItemButton, ListItemText, Typography } from "@mui/material";
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
import buildBusinessObjectsTree, {
  getBusinessObjectDescendants,
  getBusinessObjectsTreeDisplayMeta,
} from "../utils/buildBusinessObjectsTree";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import { getHoursBudgetByObjectId } from "../utils/getBusinessObjectHoursBudget";
import { formatHours } from "../utils/hoursRatioConversions";

import BusinessObjectTreeItem from "./BusinessObjectTreeItem";
import DialogBusinessObjectForm from "./DialogBusinessObjectForm";

// Objects tree of the selected business-objects listing: dnd reorder /
// reparent (drop rule + cycle guard cloned from the zonings tree), per-row
// quantities from the linked annotations. PLANNING listings (type feature
// hoursBudget) add the rolled-up hours per row and a total band.
export default function BusinessObjectsTree({ listing }) {
  // data

  const type = getBusinessObjectTypeOfListing(listing);
  const hasHoursBudget = Boolean(type.features?.hoursBudget);

  const { value: businessObjects } = useBusinessObjects({
    listingId: listing.id,
  });
  const moveBusinessObject = useMoveBusinessObject();
  const collapsedIds = useSelector((s) => s.businessObjects.collapsedIds);

  const {
    qtiesByObjectId,
    annotationsByObjectId,
    mainRelsByObjectId,
    mainAnnotationsByObjectId,
  } = useBusinessObjectQties({
    listingId: listing.id,
  });

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

  // "Numérotation" listing option: 3-column DPGF-like rendering (number /
  // label / quantity). The numbering + level metadata is computed on the FULL
  // tree so collapsing never renumbers the visible rows.
  const showNumbering = Boolean(listing.showNumbering);
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
      new Set(
        (businessObjects ?? []).map((o) => o.parentId).filter(Boolean)
      ),
    [businessObjects]
  );

  // Hide the rows whose any ancestor is collapsed (the flat tree is
  // depth-first: a collapsed node at depth d hides the following rows with
  // depth > d until a row at depth <= d shows up).
  const visibleTree = useMemo(() => {
    const visible = [];
    let hiddenBelowDepth = null;
    flatTree.forEach(({ businessObject, depth }) => {
      if (hiddenBelowDepth != null && depth > hiddenBelowDepth) return;
      hiddenBelowDepth = null;
      visible.push({ businessObject, depth });
      if (collapsedIds.includes(businessObject.id)) hiddenBelowDepth = depth;
    });
    return visible;
  }, [flatTree, collapsedIds]);

  // dnd — 5px activation so plain clicks keep selecting the object
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // handlers

  // Drop rule (zonings clone): the dragged object lands next to the hovered
  // one, adopting its parent. The new fractional sortIndex slots it
  // before/after the target among the target's siblings, depending on the
  // drag direction.
  async function handleDragEnd({ active, over }) {
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
                showNumbering={showNumbering}
                displayMeta={displayMetaById[businessObject.id]}
                qties={qtiesByObjectId[businessObject.id]}
                linkedAnnotations={annotationsByObjectId[businessObject.id]}
                soloAnnotations={soloAnnotationsByObjectId[businessObject.id]}
                mainRels={mainRelsByObjectId[businessObject.id]}
                mainAnnotations={mainAnnotationsByObjectId[businessObject.id]}
                hoursBudget={hoursBudget?.totalById[businessObject.id] ?? null}
                onAddChildBusinessObject={() =>
                  setCreateTarget({ parentBusinessObject: businessObject })
                }
              />
            ))}
            {flatTree.length === 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ pl: 2, py: 0.5, display: "block" }}
              >
                {type.strings.empty}
              </Typography>
            )}
          </List>
        </SortableContext>
      </DndContext>

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

      {createTarget && (
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
