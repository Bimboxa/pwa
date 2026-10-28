import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setTreeMode,
  setTreeScopeId,
  setTreeStateFilter,
} from "../businessObjectsSlice";

import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";

import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";

import SearchBar from "Features/search/components/SearchBar";
import useNotesAppListingConfig from "Features/notesApp/hooks/useNotesAppListingConfig";
import {
  COLOR_HEX,
  getPrimaryStateModel,
} from "Features/notesApp/utils/notesAppStateModels";

import useBusinessObjects from "../hooks/useBusinessObjects";
import useMoveBusinessObject from "../hooks/useMoveBusinessObject";
import useBusinessObjectQties from "../hooks/useBusinessObjectQties";
import useBusinessObjectsListCard from "../hooks/useBusinessObjectsListCard";
import useRelsBusinessObjectResource from "../hooks/useRelsBusinessObjectResource";
import sortDocumentRels from "../utils/sortDocumentRels";
import useTaskPlanningProgress from "Features/planning/hooks/useTaskPlanningProgress";
import buildBusinessObjectsTree, {
  buildBusinessObjectsChildrenMap,
  getBusinessObjectAncestors,
  getBusinessObjectDescendants,
  getBusinessObjectsTreeDisplayMeta,
} from "../utils/buildBusinessObjectsTree";
import matchesBusinessObjectSearch from "../utils/matchesBusinessObjectSearch";
import isBusinessObjectsTreeListing from "../utils/isBusinessObjectsTreeListing";
import getBusinessObjectStateId from "../utils/getBusinessObjectStateId";
import useBusinessObjectTypeOfListing from "../hooks/useBusinessObjectTypeOfListing";
import { isBusinessObjectClosed } from "../utils/getBusinessObjectStatus";
import selectSelectedBusinessObjectId from "../utils/selectSelectedBusinessObjectId";
import scrollTreeRowIntoView from "../utils/scrollTreeRowIntoView";
import { getHoursBudgetByObjectId } from "../utils/getBusinessObjectHoursBudget";
import { formatHours } from "../utils/hoursRatioConversions";

import BandBusinessObjectsTreeScope from "./BandBusinessObjectsTreeScope";
import ChipsBusinessObjectsStateFilter from "./ChipsBusinessObjectsStateFilter";
import BusinessObjectTreeItem from "./BusinessObjectTreeItem";
import DialogBusinessObjectForm from "./DialogBusinessObjectForm";

// Objects of the selected business-objects listing, navigated by level like
// the Krnet mobile app (notes-app TreeList / EntityListScreen):
// 1. a search bar;
// 2. a state filter band — "Tous" + the open / closed status (ISSUE type) +
//   the states of the listing's primary Krnet state model —, hidden when the
//   listing carries neither;
// 3. the level band: back button, current parent (the listing at the root),
//   and the display mode toggle: CHILDREN (children of the level only, "N ›"
//   drill-down buttons) | DESCENDANTS (every descendant, indented);
// 4. the rows. Searching or filtering forces the DESCENDANTS mode over the
//   matching rows, each one showing its path under the level as secondary
//   text; the dnd is off meanwhile.
// The level and the filter live in redux (shared by the left panel and the
// popper, reset on listing switch); the search text is per instance and
// cleared on level change. Dnd reorder / reparent (drop rule + cycle guard
// cloned from the zonings tree; in DESCENDANTS mode, dropping onto the middle
// of a row nests the object under it), per-row quantities from the linked
// annotations. PLANNING listings (type feature hoursBudget) add the
// rolled-up hours per row and a total band. With the listing setting
// `listCard` (Krnet "Aperçu de l'objet"), the object rows render the
// configured avatar + primary + secondary texts instead.
// `readOnly` (Viewer module): no creation, no dnd, no edition / linking
// actions on the rows.

// sortable strategy keeping the non-dragged rows in place
const noShiftStrategy = () => null;

export default function BusinessObjectsTree({ listing, readOnly = false }) {
  const dispatch = useDispatch();

  // strings

  const allS = "Tous";
  const openS = "Ouverts";
  const closedS = "Fermés";
  const searchS = "Rechercher...";
  const noResultS = "Aucun résultat";

  // data

  const type = useBusinessObjectTypeOfListing(listing);
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
  const hasStatus = Boolean(type.features?.status);
  // Krnet "Mode arbre" off (Sondages, Prélèvements…): flat list — no level
  // band, no drill-down, no indentation, no sub-object creation.
  const isTree = isBusinessObjectsTreeListing(listing);
  const treeMode = useSelector((s) => s.businessObjects.treeMode);
  const treeScopeId = useSelector((s) => s.businessObjects.treeScopeId);
  const treeStateFilter = useSelector((s) => s.businessObjects.treeStateFilter);
  const listCard = useBusinessObjectsListCard({ listing, businessObjects });
  // object the user works on: the active one (row click), else the selected
  // one (read-only rows only select)
  const activeBusinessObjectId = useSelector(
    (s) => s.businessObjects.activeBusinessObjectId
  );
  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const focusBusinessObjectId =
    activeBusinessObjectId ?? selectedBusinessObjectId ?? null;

  // Krnet listing model: the primary state model feeds the filter chips and
  // the row badges, its state field (if any) the local values.
  const { fields, stateModels } = useNotesAppListingConfig(listing);
  const primaryStateModel = useMemo(
    () => getPrimaryStateModel(stateModels),
    [stateModels]
  );

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

  // state

  // {parentBusinessObject} | null — object creation dialog target
  const [createTarget, setCreateTarget] = useState(null);
  const [searchText, setSearchText] = useState("");
  // row to bring into view once rendered (navigation recentered on the
  // object picked while searching / filtering)
  const [pendingScrollId, setPendingScrollId] = useState(null);
  // {id, position: "BEFORE" | "INSIDE" | "AFTER"} | null — hovered drop zone
  // while dragging in DESCENDANTS mode
  const [dropTarget, setDropTarget] = useState(null);

  // refs

  const headerRef = useRef(null);
  const listRef = useRef(null);
  // object picked (row click) WHILE searching / filtering, or null
  const pickedWhileFilteringRef = useRef(null);
  const prevFilteringRef = useRef(false);
  const prevScopeIdRef = useRef(treeScopeId);

  // helpers — tree

  const objectById = useMemo(() => {
    const byId = {};
    (businessObjects ?? []).forEach((o) => {
      byId[o.id] = o;
    });
    return byId;
  }, [businessObjects]);
  const childrenMap = useMemo(
    () => buildBusinessObjectsChildrenMap(businessObjects ?? []),
    [businessObjects]
  );
  // current level: an id unknown to this listing (another listing's scope
  // shown by the Viewer panel, deleted object) reads as the root
  const scopeNode =
    isTree && treeScopeId ? (objectById[treeScopeId] ?? null) : null;
  const scopeKey = scopeNode?.id ?? "ROOT";

  // full tree: numbering, codes layout, dnd direction
  const flatTree = useMemo(
    () => buildBusinessObjectsTree(businessObjects),
    [businessObjects]
  );
  const flatIds = useMemo(
    () => flatTree.map(({ businessObject }) => businessObject.id),
    [flatTree]
  );
  // descendants of the level, depth-first, depth and path relative to it
  const scopedTree = useMemo(
    () => buildBusinessObjectsTree(businessObjects, { scopeId: scopeNode?.id }),
    [businessObjects, scopeNode?.id]
  );

  // Solo target of a row click: the object's own linked annotations + its
  // descendants' (the row display keeps the own-only counts — no hierarchical
  // aggregation). Memoized bottom-up with a cycle guard.
  const soloAnnotationsByObjectId = useMemo(() => {
    const byId = {};
    const collect = (id) => {
      if (byId[id]) return byId[id];
      byId[id] = []; // cycle guard
      const own = annotationsByObjectId[id] ?? [];
      const childAnnotations = (childrenMap[id] ?? []).flatMap((c) =>
        collect(c.id)
      );
      byId[id] = [...own, ...childAnnotations];
      return byId[id];
    };
    (businessObjects ?? []).forEach((o) => collect(o.id));
    return byId;
  }, [businessObjects, childrenMap, annotationsByObjectId]);

  // Hours budget per task (own + descendants) and listing total — tasks only.
  const hoursBudget = useMemo(
    () =>
      hasHoursBudget
        ? getHoursBudgetByObjectId(businessObjects ?? [], qtiesByObjectId)
        : null,
    [hasHoursBudget, businessObjects, qtiesByObjectId]
  );

  // Listing with codes (stored `code` of the objects — imported, typed or
  // written by "Renuméroter") or type numbering its rows at display time
  // (feature autoNumbering): 3-column DPGF-like rendering (code / label /
  // quantity). The level metadata is computed on the FULL tree.
  const hasAutoNumbering = Boolean(type.features?.autoNumbering);
  const showCodes = useMemo(
    () =>
      hasAutoNumbering || (businessObjects ?? []).some((o) => Boolean(o.code)),
    [businessObjects, hasAutoNumbering]
  );
  const displayMetaById = useMemo(() => {
    const metas = getBusinessObjectsTreeDisplayMeta(flatTree);
    const byId = {};
    flatTree.forEach(({ businessObject }, i) => {
      byId[businessObject.id] = metas[i];
    });
    return byId;
  }, [flatTree]);

  // helpers — states

  // state id of every object in the primary state model
  const stateIdById = useMemo(() => {
    const byId = {};
    if (!primaryStateModel) return byId;
    (businessObjects ?? []).forEach((o) => {
      byId[o.id] = getBusinessObjectStateId(o, primaryStateModel.id, fields);
    });
    return byId;
  }, [businessObjects, primaryStateModel, fields]);
  const stateById = useMemo(
    () =>
      Object.fromEntries(
        (primaryStateModel?.states ?? []).map((s) => [s.id, s])
      ),
    [primaryStateModel]
  );

  // Filter chips: counts over the level's descendants (the whole listing at
  // the root), like Krnet.
  const filterOptions = useMemo(() => {
    const scoped = scopedTree.map(({ businessObject }) => businessObject);
    const options = [{ value: "ALL", label: allS, count: scoped.length }];
    if (hasStatus) {
      const closed = scoped.filter(isBusinessObjectClosed).length;
      options.push(
        { value: "OPEN", label: openS, count: scoped.length - closed },
        { value: "CLOSED", label: closedS, count: closed }
      );
    }
    (primaryStateModel?.states ?? []).forEach((state) => {
      options.push({
        value: state.id,
        label: state.name,
        count: scoped.filter((o) => stateIdById[o.id] === state.id).length,
        color: COLOR_HEX[state.color] ?? COLOR_HEX.blue,
      });
    });
    return options;
  }, [scopedTree, hasStatus, primaryStateModel, stateIdById]);
  const showStateFilter = hasStatus || Boolean(primaryStateModel);
  // a stored filter unknown to this listing reads as "Tous"
  const stateFilter = filterOptions.some((o) => o.value === treeStateFilter)
    ? treeStateFilter
    : "ALL";

  const matchesStateFilter = (o) => {
    if (stateFilter === "ALL") return true;
    if (stateFilter === "OPEN") return !isBusinessObjectClosed(o);
    if (stateFilter === "CLOSED") return isBusinessObjectClosed(o);
    return stateIdById[o.id] === stateFilter;
  };

  // helpers — rows

  const query = searchText.trim();
  const filtering = Boolean(query) || stateFilter !== "ALL";
  const effectiveMode = filtering || !isTree ? "DESCENDANTS" : treeMode;
  const childrenMode = effectiveMode === "CHILDREN";

  const rows = useMemo(() => {
    if (childrenMode) {
      return (childrenMap[scopeKey] ?? []).map((businessObject) => ({
        businessObject,
        depth: 0,
        parentPath: "",
      }));
    }
    if (!filtering) return scopedTree;
    return scopedTree.filter(
      ({ businessObject }) =>
        matchesBusinessObjectSearch(businessObject, query) &&
        matchesStateFilter(businessObject)
    );
  }, [
    childrenMode,
    childrenMap,
    scopeKey,
    filtering,
    scopedTree,
    query,
    stateFilter,
    stateIdById,
  ]);
  const rowIds = useMemo(
    () => rows.map(({ businessObject }) => businessObject.id),
    [rows]
  );

  // level band texts
  const listingName = listing.name ?? listing.label ?? type.strings.listLabel;
  const scopeTitle = scopeNode ? scopeNode.label : listingName;
  const scopeSubtitle = scopeNode
    ? [
        listingName,
        ...getBusinessObjectAncestors(businessObjects ?? [], scopeNode.id).map(
          (o) => o.label
        ),
      ].join(" / ")
    : null;

  const emptyS = filtering ? noResultS : type.strings.empty;
  const addS = scopeNode ? type.strings.addChild : type.strings.newObject;
  const canAddChildren = isTree && !readOnly;

  // dnd — 5px activation so plain clicks keep selecting the object
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  // DESCENDANTS mode ("Liste"): drop zones per row (before / inside / after),
  // the rows stay still so the hovered target doesn't slip under the pointer
  const nestDnd = isTree && !childrenMode && !filtering && !readOnly;

  // effects — a level change clears the search (Krnet handleScopeChange)

  useEffect(() => {
    setSearchText("");
  }, [treeScopeId]);

  // effects — an object picked while searching / filtering is remembered…

  useEffect(() => {
    if (filtering && focusBusinessObjectId && objectById[focusBusinessObjectId])
      pickedWhileFilteringRef.current = focusBusinessObjectId;
  }, [filtering, focusBusinessObjectId, objectById]);

  // …and when the filtering ends, the navigation recenters on it: CHILDREN
  // mode shows its siblings (level = its parent); DESCENDANTS mode keeps the
  // level when the object lies under it, else moves to its parent too; the
  // row is then scrolled to the top. Not when the filtering ended because the
  // user changed level himself (back button clears the search).

  useEffect(() => {
    const wasFiltering = prevFilteringRef.current;
    const scopeChanged = prevScopeIdRef.current !== treeScopeId;
    prevFilteringRef.current = filtering;
    prevScopeIdRef.current = treeScopeId;
    if (filtering || !wasFiltering) return;
    const pickedId = pickedWhileFilteringRef.current;
    pickedWhileFilteringRef.current = null;
    if (scopeChanged || !pickedId) return;
    const picked = objectById[pickedId];
    if (!picked) return;
    const parentId =
      picked.parentId && objectById[picked.parentId] ? picked.parentId : null;
    const underScope =
      !scopeNode ||
      getBusinessObjectAncestors(businessObjects ?? [], pickedId).some(
        (o) => o.id === scopeNode.id
      );
    if (isTree && (treeMode === "CHILDREN" || !underScope)) {
      dispatch(setTreeScopeId(parentId));
    }
    setPendingScrollId(pickedId);
  }, [
    filtering,
    treeScopeId,
    treeMode,
    scopeNode,
    objectById,
    businessObjects,
    isTree,
    dispatch,
  ]);

  useEffect(() => {
    if (!pendingScrollId) return;
    if (!rowIds.includes(pendingScrollId)) return;
    const row = listRef.current?.querySelector(
      `[data-business-object-id="${pendingScrollId}"]`
    );
    if (row) scrollTreeRowIntoView(row, headerRef.current);
    setPendingScrollId(null);
  }, [pendingScrollId, rowIds]);

  // handlers

  function handleStateFilterChange(value) {
    dispatch(setTreeStateFilter(value));
  }

  function handleModeChange(value) {
    dispatch(setTreeMode(value));
  }

  function handleDrill(businessObject) {
    dispatch(setTreeScopeId(businessObject.id));
  }

  function handleBack() {
    const parentId = scopeNode?.parentId;
    dispatch(
      setTreeScopeId(parentId && objectById[parentId] ? parentId : null)
    );
  }

  // helpers — dnd

  // pointer position in the hovered row: top quarter → BEFORE, middle half →
  // INSIDE, bottom quarter → AFTER
  function getDropPosition({ activatorEvent, delta, over }) {
    const rect = over?.rect;
    if (!rect?.height || activatorEvent?.clientY == null) return null;
    const ratio = (activatorEvent.clientY + delta.y - rect.top) / rect.height;
    if (ratio < 0.25) return "BEFORE";
    if (ratio > 0.75) return "AFTER";
    return "INSIDE";
  }

  // cycle guard: never drop an object into its own subtree
  function isValidDrop(dragged, target) {
    if (!dragged || !target || dragged.id === target.id) return false;
    return !getBusinessObjectDescendants(businessObjects, dragged.id).some(
      (d) => d.id === target.id
    );
  }

  // handlers — dnd

  function handleDragMove(event) {
    if (!nestDnd) return;
    const { active, over } = event;
    const position = over ? getDropPosition(event) : null;
    const valid =
      position && isValidDrop(objectById[active.id], objectById[over.id]);
    const next = valid ? { id: over.id, position } : null;
    setDropTarget((prev) =>
      prev?.id === next?.id && prev?.position === next?.position ? prev : next
    );
  }

  function handleDragCancel() {
    setDropTarget(null);
  }

  // Drop rule (zonings clone): the dragged object lands next to the hovered
  // one, adopting its parent. The new fractional sortIndex slots it
  // before/after the target among the target's siblings — depending on the
  // hovered zone of the row in DESCENDANTS mode, on the drag direction
  // otherwise. DESCENDANTS mode, middle of the row: the object becomes the
  // last child of the target.
  async function handleDragEnd({ active, over }) {
    const dropPosition = dropTarget?.position ?? null;
    setDropTarget(null);
    if (readOnly || filtering) return;
    if (!over || active.id === over.id) return;
    const dragged = businessObjects?.find((o) => o.id === active.id);
    const target = businessObjects?.find((o) => o.id === over.id);
    if (!isValidDrop(dragged, target)) return;

    const position = nestDnd
      ? dropPosition
      : flatIds.indexOf(active.id) < flatIds.indexOf(over.id)
        ? "AFTER"
        : "BEFORE";
    if (!position) return;

    if (position === "INSIDE") {
      const lastChild = (childrenMap[target.id] ?? [])
        .filter((o) => o.id !== dragged.id)
        .at(-1);
      let sortIndex;
      try {
        sortIndex = generateKeyBetween(lastChild?.sortIndex ?? null, null);
      } catch (e) {
        console.warn("[BusinessObjectsTree] sortIndex generation failed", e);
        return;
      }
      await moveBusinessObject(dragged.id, { parentId: target.id, sortIndex });
      return;
    }

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
      if (position === "AFTER") {
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
    <Box>
      {/* Search, filter chips and level band stick to the top of the host's
          scroll area (the host card clips without scrolling). */}
      <Box
        ref={headerRef}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ p: 1 }}>
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            placeholder={searchS}
            fullWidth
          />
        </Box>

        {showStateFilter && (
          <ChipsBusinessObjectsStateFilter
            options={filterOptions}
            value={stateFilter}
            onChange={handleStateFilterChange}
          />
        )}

        {isTree && (
          <BandBusinessObjectsTreeScope
            title={scopeTitle}
            subtitle={scopeSubtitle}
            onBack={scopeNode ? handleBack : null}
            mode={effectiveMode}
            onModeChange={handleModeChange}
          />
        )}
      </Box>

      <DndContext
        id={`business-objects-dnd-${listing.id}`}
        sensors={sensors}
        collisionDetection={nestDnd ? pointerWithin : closestCenter}
        onDragMove={handleDragMove}
        onDragOver={handleDragMove}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={rowIds}
          strategy={nestDnd ? noShiftStrategy : verticalListSortingStrategy}
        >
          <List dense disablePadding ref={listRef}>
            {rows.map(({ businessObject, depth, parentPath }) => {
              const childCount = (childrenMap[businessObject.id] ?? []).length;
              const showDrill = childrenMode && (!readOnly || childCount > 0);
              const stateId = stateIdById[businessObject.id];
              return (
                <BusinessObjectTreeItem
                  key={businessObject.id}
                  businessObject={businessObject}
                  depth={depth}
                  indent={isTree && !childrenMode}
                  drillCount={showDrill ? childCount : null}
                  onDrill={handleDrill}
                  pathLabel={filtering ? parentPath : null}
                  stateBadge={stateId ? (stateById[stateId] ?? null) : null}
                  dndDisabled={filtering}
                  dropIndicator={
                    dropTarget?.id === businessObject.id
                      ? dropTarget.position
                      : null
                  }
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
                  hoursBudget={
                    hoursBudget?.totalById[businessObject.id] ?? null
                  }
                  planningProgress={
                    planningProgress.byTaskId[businessObject.id] ?? null
                  }
                  onAddChildBusinessObject={
                    canAddChildren
                      ? () =>
                          setCreateTarget({
                            parentBusinessObject: businessObject,
                          })
                      : undefined
                  }
                />
              );
            })}
            {rows.length === 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ pl: 2, py: 1, display: "block" }}
              >
                {emptyS}
              </Typography>
            )}
          </List>
        </SortableContext>
      </DndContext>

      {/* creation under the current level (Krnet "Ajouter") */}
      {!readOnly && (
        <ListItemButton
          onClick={() => setCreateTarget({ parentBusinessObject: scopeNode })}
          sx={{ pl: 2, color: "text.disabled" }}
        >
          <Add sx={{ fontSize: 20, mr: 1 }} color="disabled" />
          <ListItemText
            primary={addS}
            slotProps={{
              primary: { variant: "body2", color: "text.disabled" },
            }}
          />
        </ListItemButton>
      )}

      {/* listing total of the hours budget — sticky at the bottom of the
          panel's scroll area */}
      {hasHoursBudget && (
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
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
