import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { generateKeyBetween } from "fractional-indexing";

import {
  toggleBaseMapVisibleIn3d,
  toggleScene3dHiddenIn3d,
  setBaseMapAnnotationsModeIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";
import {
  toggleBaseMapVisibleIn2d,
  toggleBaseMapAnnotationsIn2d,
} from "Features/viewers/viewersSlice";
import {
  setBaseMapsGridSelectedBaseMapId,
  toggleBaseMapsGridImageHidden,
  toggleBaseMapsGridAnnotationsHidden,
} from "Features/baseMapsGrid/baseMapsGridSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import {
  setCreatingInListingId,
  setDetailBaseMapId,
  setDisplayedBaseMapListingId,
} from "Features/baseMapEditor/baseMapEditorSlice";
import { setLeftPanelDocked } from "Features/leftPanel/leftPanelSlice";
import { setAutoBaseMapVisibility } from "Features/popperMapListings/popperMapListingsSlice";

import {
  Box,
  Divider,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import Check from "@mui/icons-material/Check";
import Close from "@mui/icons-material/Close";

import RowBaseMapInList from "./RowBaseMapInList";
import PopoverBaseMapVersions from "./PopoverBaseMapVersions";
import IconButtonMoreActionsBaseMap from "Features/baseMapEditor/components/IconButtonMoreActionsBaseMap";
import IconButtonMoreActionsBaseMapListing from "Features/baseMapEditor/components/IconButtonMoreActionsBaseMapListing";
import DialogCreateBaseMapVersion from "Features/baseMapEditor/components/DialogCreateBaseMapVersion";
import RowPanelOptionCheckbox from "Features/layout/components/RowPanelOptionCheckbox";

import db from "App/db/db";
import useHideOtherBaseMaps from "../hooks/useHideOtherBaseMaps";
import createBaseMapVersionFromSource from "../services/createBaseMapVersionFromSource";
import useBaseMaps from "../hooks/useBaseMaps";
import useProjectBaseMapListings from "../hooks/useProjectBaseMapListings";
import useMainBaseMapVisibilityToggles from "../hooks/useMainBaseMapVisibilityToggles";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMoveBaseMapToListing from "../hooks/useMoveBaseMapToListing";
import reorderBaseMapInListing from "../utils/reorderBaseMapInListing";
import ensureBaseMapSortIndexes from "../utils/ensureBaseMapSortIndexes";
import areBaseMapsParallel from "../js/areBaseMapsParallel";
import { selectBaseMapsGridScopeOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";
import { getScene3dDisplay3d } from "Features/scene3d/constants/scene3dConstants";

// ---------------------------------------------------------------------------
// SectionBaseMapsList — "Fonds de plan" side of the popper / PanelDrawing /
// PanelViewer: the scope's base maps grouped by listing, one row each with
// the name, the "3D" scan button, the annotations badge and the image eye.
// Row click selects the base map as main (same as the top bar selector).
// The left handle drags a row to reorder the base maps INSIDE its listing
// (fractional sortIndex, same order as the BaseMaps module tree).
//
// Controls per row (replaces the removed TopBaseMapChipsThreed band):
// - main base map: eye + badge drive the DISPLAYED editor's state through
//   useMainBaseMapVisibilityToggles (2D `viewers.hide*InViewer`, 3D
//   `threedEditor.hideMain*In3d`);
// - other base maps, 3D displayed: eye = visibleBaseMapIdsIn3d, badge =
//   annotationsModeByBaseMapIdIn3d (NONE ⇄ NORMAL);
// - other base maps, 2D displayed: only the base maps PARALLEL to the main
//   one are listed (the levels of a building, not its sections); eye =
//   viewers.visibleBaseMapIdsIn2d, badge = viewers.annotationsBaseMapIdsIn2d
//   — the image / annotations overlaid, greyed, on the main base map (see
//   Features/baseMapOverlays). An uncalibrated base map (no meterByPx)
//   cannot be placed: no eye, plain count.
// - BaseMaps module, 2D displayed: every base map is listed (the module's
//   editing surface); the main row has no eye (the image is edited there),
//   the PARALLEL rows get the 2D overlay eye / badge — the overlays and
//   their move / rotate work in the module's editor like in Dessin.
// - "3D" button (scan base maps only): hiddenScene3dBaseMapIdsIn3d, a 3D
//   state toggled from either editor.
// - SCOPE module (pinned base maps grid): the rows are the SHEETS of the
//   table (baseMapsGrid.scopeSheets — the base maps concerned by the content
//   filter; every base map while the scope has no annotation at all, see
//   useScopeGridSheets), no main base map: a click selects the sheet (table
//   highlight + BASE_MAP item of the properties panel); the eye and the
//   badge toggle the image / annotations of THAT sheet
//   (baseMapsGrid.hidden*BaseMapIds, the same states under both editors —
//   the 3D eyes / modes are not involved).
//   `countByBaseMapIdOverride`: counts narrowed like the legend (the popper
//   passes them).
// - BaseMaps module (`editable`): the list is also the module's editing
//   surface, same actions as the expanded left panel (BaseMapTreeItem) —
//   every folder is listed (empty ones included) under a header carrying a
//   "+" (new base map in the folder, fullscreen creation section) and the
//   folder "…" menu (rename / add / delete); each row carries the base map
//   "…" menu (properties / rename / new version / orientation / delete).
//   Renames are inline (one at a time, folders and base maps alike). A row
//   can also be dragged to ANOTHER folder (onto one of its rows = inserted
//   before it, onto its header = appended; useMoveBaseMapToListing, same
//   cascade as the left panel tree) — the other surfaces reorder only.
// ---------------------------------------------------------------------------

// Collision detection of the single DndContext: pointer position first
// (accurate over rows and headers), rect intersection as a fallback.
function listCollisionDetection(args) {
  const within = pointerWithin(args);
  if (within.length > 0) return within;
  return rectIntersection(args);
}

const GROUP_DROPPABLE_PREFIX = "group:";

export default function SectionBaseMapsList({ countByBaseMapIdOverride }) {
  const dispatch = useDispatch();

  // strings

  const emptyS = "Aucun fond de plan";
  const othersS = "Autres";
  const versionS = "Version";
  const newBaseMapS = "Nouveau fond de plan";
  const autoVisibilityS = "Visibilité auto";
  const autoVisibilityTooltipS =
    "Au changement de fond de plan : masque l'image et les annotations des autres fonds de plan.";

  // data

  const autoBaseMapVisibility = useSelector(
    (s) => s.popperMapListings.autoBaseMapVisibility
  );
  const hideOtherBaseMaps = useHideOtherBaseMaps();
  const { value: baseMaps = [] } = useBaseMaps({});
  const listings = useProjectBaseMapListings() ?? [];
  const mainBaseMap = useMainBaseMap();
  const selectMainBaseMap = useSelectMainBaseMap();
  const updateEntity = useUpdateEntity();
  const moveBaseMapToListing = useMoveBaseMapToListing();
  const annotationsCountByBaseMapId = useAnnotationsCountByBaseMapId();
  const {
    isThreedDisplayed,
    imageOn: mainImageOn,
    annotationsOn: mainAnnotationsOn,
    toggleImage: toggleMainImage,
    toggleAnnotations: toggleMainAnnotations,
  } = useMainBaseMapVisibilityToggles();

  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const hiddenScanIds = useSelector(
    (s) => s.threedEditor.hiddenScene3dBaseMapIdsIn3d
  );
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const visibleIdsIn2d = useSelector((s) => s.viewers.visibleBaseMapIdsIn2d);
  const annotationsIdsIn2d = useSelector(
    (s) => s.viewers.annotationsBaseMapIdsIn2d
  );
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const hideEmpty = useSelector(
    (s) => s.popperMapListings.hideEmptyBaseMapsInList
  );
  // SCOPE module with its grid displayed (see the header comment); with the
  // grid left, the rows get their regular semantics back.
  const pinned = useSelector(selectBaseMapsGridScopeOpen);
  const scopeSheetIds = useSelector(
    (s) => s.baseMapsGrid.scopeSheets.baseMapIds
  );
  const gridSelectedBaseMapId = useSelector(
    (s) => s.baseMapsGrid.selectedBaseMapId
  );
  const gridHiddenImageIds = useSelector(
    (s) => s.baseMapsGrid.hiddenImageBaseMapIds
  );
  const gridHiddenAnnotationsIds = useSelector(
    (s) => s.baseMapsGrid.hiddenAnnotationsBaseMapIds
  );

  // state

  const [versionsAnchorEl, setVersionsAnchorEl] = useState(null);
  // inline rename (a folder or a base map id) + "Nouvelle version" dialog
  const [editingItemId, setEditingItemId] = useState(null);
  const [tempTitle, setTempTitle] = useState("");
  const [createVersionForBaseMap, setCreateVersionForBaseMap] = useState(null);
  // dnd: the dragged base map (DragOverlay) + the hovered FOREIGN folder
  const [activeDragBaseMap, setActiveDragBaseMap] = useState(null);
  const [overListingId, setOverListingId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // helpers

  const isViewerModule = viewerKey === "THREED";
  // BaseMaps module: the image is edited in its 2D editor (no eye there,
  // same as the top bar — the 3D editor keeps the eyes), and the drawing
  // annotations are loaded only with the panel switch.
  const isBaseMapsModule = viewerKey === "BASE_MAPS";
  // BaseMaps module: editing affordances (see the header comment).
  const editable = isBaseMapsModule && !pinned;
  const showMainImageEye = !isBaseMapsModule || isThreedDisplayed;
  const hideAnnotationsBadge = isBaseMapsModule && !showAnnotationsInBaseMaps;
  // 2D editors: the other base maps can be overlaid on the main one — only
  // the ones parallel to it. The BaseMaps module lists EVERY base map (its
  // editing surface) and offers the overlay eye on the parallel ones only;
  // the other 2D editors list the parallel ones alone.
  const overlaysIn2d = !isThreedDisplayed;
  const listParallelOnly = overlaysIn2d && !isBaseMapsModule;
  const mainMeterByPx = mainBaseMap?.getMeterByPx?.();

  // The folders hidden in the scope are already out (useBaseMaps). The
  // "hide empty" list option (properties panel) drops the annotation-less
  // base maps, unless they are shown in 3D (image or annotations) or
  // overlaid in 2D.
  const groups = useMemo(() => {
    // pinned grid: the sheets of the table, nothing else
    const sheetIdSet = pinned ? new Set(scopeSheetIds) : null;
    const enabled = baseMaps.filter((bm) =>
      sheetIdSet
        ? sheetIdSet.has(bm.id)
        : (!listParallelOnly ||
            !mainBaseMap ||
            bm.id === mainBaseMap.id ||
            areBaseMapsParallel(bm, mainBaseMap)) &&
          (!hideEmpty ||
            bm.id === mainBaseMap?.id ||
            (annotationsCountByBaseMapId[bm.id] ?? 0) > 0 ||
            (overlaysIn2d
              ? visibleIdsIn2d.includes(bm.id) ||
                annotationsIdsIn2d.includes(bm.id)
              : visibleIds.includes(bm.id) ||
                Boolean(annotationsModeByBaseMapId?.[bm.id])))
    );
    const byListing = new Map();
    for (const bm of enabled) {
      const key = bm.listingId ?? "__none__";
      if (!byListing.has(key)) byListing.set(key, []);
      byListing.get(key).push(bm);
    }
    const ordered = [];
    for (const listing of listings) {
      // editable list: every folder, the empty ones included (a folder just
      // created must be reachable to get its first base map)
      if (byListing.has(listing.id) || editable) {
        ordered.push({
          id: listing.id,
          name: listing.name,
          listing,
          baseMaps: byListing.get(listing.id) ?? [],
        });
        byListing.delete(listing.id);
      }
    }
    for (const [key, bms] of byListing) {
      // leftover group (no / unknown listing): not sortable
      ordered.push({ id: key, name: othersS, listing: null, baseMaps: bms });
    }
    return ordered;
  }, [
    baseMaps,
    listings,
    mainBaseMap,
    othersS,
    hideEmpty,
    annotationsCountByBaseMapId,
    visibleIds,
    annotationsModeByBaseMapId,
    overlaysIn2d,
    listParallelOnly,
    visibleIdsIn2d,
    annotationsIdsIn2d,
    pinned,
    scopeSheetIds,
    editable,
  ]);

  const mainVersions = mainBaseMap?.versions ?? [];
  const activeVersion =
    mainVersions.find((v) => v.isActive) || mainVersions[0] || null;

  function getRowProps(map) {
    if (pinned) return getPinnedRowProps(map);
    const isMain = map.id === mainBaseMap?.id;
    // Overlay on the main base map (2D): both scales are needed to place it,
    // and the base map must be parallel to the main one (already the case in
    // the editors listing the parallel ones alone).
    const canOverlayIn2d =
      overlaysIn2d &&
      mainMeterByPx > 0 &&
      map.getMeterByPx?.() > 0 &&
      (listParallelOnly ||
        (Boolean(mainBaseMap) && areBaseMapsParallel(map, mainBaseMap)));

    const imageEye = isMain
      ? showMainImageEye
        ? { on: mainImageOn, onToggle: toggleMainImage }
        : null
      : isThreedDisplayed
        ? {
            on: visibleIds.includes(map.id),
            onToggle: () => dispatch(toggleBaseMapVisibleIn3d(map.id)),
          }
        : canOverlayIn2d
          ? {
              on: visibleIdsIn2d.includes(map.id),
              onToggle: () => dispatch(toggleBaseMapVisibleIn2d(map.id)),
            }
          : null;

    const count = annotationsCountByBaseMapId[map.id] ?? 0;
    const annotationsMode =
      annotationsModeByBaseMapId?.[map.id] ?? ANNOTATIONS_DISPLAY_MODE.NONE;
    const otherAnnotationsOn =
      annotationsMode !== ANNOTATIONS_DISPLAY_MODE.NONE;
    const annotationsBadge = hideAnnotationsBadge
      ? null
      : isMain
        ? { count, on: mainAnnotationsOn, onToggle: toggleMainAnnotations }
        : isThreedDisplayed
          ? {
              count,
              on: otherAnnotationsOn,
              onToggle: () =>
                dispatch(
                  setBaseMapAnnotationsModeIn3d({
                    baseMapId: map.id,
                    mode: otherAnnotationsOn
                      ? ANNOTATIONS_DISPLAY_MODE.NONE
                      : ANNOTATIONS_DISPLAY_MODE.NORMAL,
                  })
                ),
            }
          : canOverlayIn2d
            ? {
                count,
                on: annotationsIdsIn2d.includes(map.id),
                onToggle: () => dispatch(toggleBaseMapAnnotationsIn2d(map.id)),
              }
            : { count, on: false, onToggle: null };

    const scanButton = map.scene3d
      ? {
          on: !hiddenScanIds.includes(map.id),
          disabled: getScene3dDisplay3d(map) !== "MESH",
          onToggle: () => dispatch(toggleScene3dHiddenIn3d(map.id)),
        }
      : null;

    // The Viewer module has no version selector in the top bar.
    const versionChip =
      isMain && isViewerModule && mainVersions.length > 1
        ? {
            label: activeVersion?.label || versionS,
            onOpen: (e) => setVersionsAnchorEl(e.currentTarget),
          }
        : null;

    return { isMain, imageEye, annotationsBadge, scanButton, versionChip };
  }

  // Pinned grid rows (see the header comment).
  function getPinnedRowProps(map) {
    const imageEye = {
      on: !gridHiddenImageIds.includes(map.id),
      onToggle: () => dispatch(toggleBaseMapsGridImageHidden(map.id)),
    };
    const annotationsBadge = {
      count:
        countByBaseMapIdOverride?.[map.id] ??
        annotationsCountByBaseMapId[map.id] ??
        0,
      on: !gridHiddenAnnotationsIds.includes(map.id),
      onToggle: () => dispatch(toggleBaseMapsGridAnnotationsHidden(map.id)),
    };
    const scanButton = map.scene3d
      ? {
          on: !hiddenScanIds.includes(map.id),
          disabled: getScene3dDisplay3d(map) !== "MESH",
          onToggle: () => dispatch(toggleScene3dHiddenIn3d(map.id)),
        }
      : null;
    return {
      // highlighted row = the sheet selected on the table
      isMain: map.id === gridSelectedBaseMapId,
      imageEye,
      annotationsBadge,
      scanButton,
      versionChip: null,
    };
  }

  // handlers

  // handlers - dnd (one context for every folder)

  // The drop target: { listingId, overBaseMapId } — a row (insert before
  // it) or a folder header (append), null otherwise.
  function getDropTarget(over) {
    const data = over?.data?.current;
    if (!data) return null;
    if (data.type === "baseMap")
      return { listingId: data.listingId, overBaseMapId: over.id };
    if (data.type === "group")
      return { listingId: data.listingId, overBaseMapId: null };
    return null;
  }

  function handleDragStart({ active }) {
    setActiveDragBaseMap(baseMaps.find((bm) => bm.id === active.id) ?? null);
  }

  function handleDragOver({ active, over }) {
    const target = getDropTarget(over);
    const sourceListingId = active.data.current?.listingId;
    setOverListingId(
      editable && target && target.listingId !== sourceListingId
        ? target.listingId
        : null
    );
  }

  function handleDragCancel() {
    setActiveDragBaseMap(null);
    setOverListingId(null);
  }

  // Reorder inside the listing, or move to another one (editable list). The
  // new sortIndex is computed against EVERY base map of the target listing,
  // not the (possibly filtered) displayed rows.
  async function handleDragEnd({ active, over }) {
    setActiveDragBaseMap(null);
    setOverListingId(null);
    const target = getDropTarget(over);
    if (!target || active.id === target.overBaseMapId) return;
    const sourceListingId = active.data.current?.listingId;
    const baseMap = baseMaps.find((bm) => bm.id === active.id);
    const targetListing = listings.find((l) => l.id === target.listingId);
    if (!baseMap || !targetListing) return;
    const targetGroup = baseMaps.filter(
      (bm) => bm.listingId === targetListing.id
    );
    try {
      if (targetListing.id === sourceListingId) {
        if (!target.overBaseMapId) return; // dropped on its own header
        await reorderBaseMapInListing({
          baseMap,
          overBaseMapId: target.overBaseMapId,
          group: targetGroup,
          listing: targetListing,
          updateEntity,
        });
        return;
      }
      if (!editable) return;
      await moveBaseMapAcrossListings(
        baseMap,
        sourceListingId,
        targetListing,
        targetGroup,
        target.overBaseMapId
      );
    } catch (e) {
      console.error("[SectionBaseMapsList] DnD error:", e);
    }
  }

  // Same as BaseMapTree.moveBaseMapAcrossListings.
  async function moveBaseMapAcrossListings(
    baseMap,
    sourceListingId,
    targetListing,
    targetGroup,
    overBaseMapId
  ) {
    const sortIndices = await ensureBaseMapSortIndexes(
      targetGroup,
      targetListing,
      updateEntity
    );
    let newSortIndex;
    if (overBaseMapId) {
      const overIdx = targetGroup.findIndex((bm) => bm.id === overBaseMapId);
      newSortIndex = generateKeyBetween(
        overIdx > 0 ? sortIndices[overIdx - 1] : null,
        sortIndices[overIdx] ?? null
      );
    } else {
      newSortIndex = generateKeyBetween(
        sortIndices.length > 0 ? sortIndices[sortIndices.length - 1] : null,
        null
      );
    }
    await moveBaseMapToListing({
      baseMapId: baseMap.id,
      sourceListingId,
      targetListingId: targetListing.id,
      newSortIndex,
    });
    // The main base map followed: keep the listing selection in sync.
    if (baseMap.id === mainBaseMap?.id) {
      dispatch(setSelectedBaseMapsListingId(targetListing.id));
      dispatch(setDisplayedBaseMapListingId(targetListing.id));
    }
  }

  function handleSelect(map) {
    if (pinned) {
      // the sheet on the table + the item of the properties panel — never
      // the main base map (the anchor of the 3D table)
      dispatch(setBaseMapsGridSelectedBaseMapId(map.id));
      dispatch(
        setSelectedItem({
          id: map.id,
          type: "BASE_MAP",
          listingId: map.listingId,
        })
      );
      return;
    }
    selectMainBaseMap(map.id);
    // "Visibilité auto": the selected base map shown fully, every other
    // one hidden (image + annotations) in the displayed editor.
    if (autoBaseMapVisibility) hideOtherBaseMaps();
    // Keep the listing selection in sync: baseMap creation & url params
    // still read selectedBaseMapsListingId.
    if (map.listingId) dispatch(setSelectedBaseMapsListingId(map.listingId));
  }

  // handlers - BaseMaps module editing (same flows as BaseMapTreeItem)

  // "+" of a folder: the fullscreen creation section (LayerCreateBaseMap)
  // targets selectedBaseMapsListingId first, hence the extra dispatch.
  function handleAddBaseMap(listing) {
    dispatch(setDisplayedBaseMapListingId(listing.id));
    dispatch(setSelectedBaseMapsListingId(listing.id));
    dispatch(setCreatingInListingId(listing.id));
  }

  // "Propriétés du fond de plan": the detail view (versions / Position 3D)
  // lives in the left panel only — dock it on that view.
  function handleOpenProperties(map) {
    handleSelect(map);
    dispatch(setDetailBaseMapId(map.id));
    dispatch(setLeftPanelDocked(true));
  }

  function handleStartRename(item) {
    setEditingItemId(item.id);
    setTempTitle(item.name ?? "");
  }

  function handleCancelRename() {
    setEditingItemId(null);
  }

  async function handleConfirmRenameListing(listing) {
    await db.listings.update(listing.id, { name: tempTitle });
    setEditingItemId(null);
  }

  async function handleConfirmRenameBaseMap(map, listing) {
    await updateEntity(map.id, { name: tempTitle }, { listing });
    setEditingItemId(null);
  }

  async function handleCreateVersionFromDialog({ label, sourceVersion }) {
    await createBaseMapVersionFromSource({
      targetBaseMap: createVersionForBaseMap,
      label,
      sourceVersion,
    });
    setCreateVersionForBaseMap(null);
  }

  function getRenamingProps(item, onConfirm) {
    if (!editable || editingItemId !== item.id) return null;
    return {
      value: tempTitle,
      onChange: setTempTitle,
      onConfirm,
      onCancel: handleCancelRename,
    };
  }

  // render

  if (groups.length === 0) {
    return (
      <Typography
        variant="caption"
        sx={{
          display: "block",
          px: 2,
          py: 1.5,
          color: "panel.textMuted",
          fontStyle: "italic",
        }}
      >
        {emptyS}
      </Typography>
    );
  }

  function renderGroupHeader(group) {
    const listing = group.listing;
    const folderActions = Boolean(editable && listing);
    return (
      <GroupHeader
        group={group}
        droppable={folderActions}
        isDropTarget={Boolean(listing) && overListingId === listing.id}
        showActions={folderActions}
        renaming={
          folderActions && editingItemId === listing.id
            ? {
                value: tempTitle,
                onChange: setTempTitle,
                onConfirm: () => handleConfirmRenameListing(listing),
                onCancel: handleCancelRename,
              }
            : null
        }
        newBaseMapS={newBaseMapS}
        onAddBaseMap={() => handleAddBaseMap(listing)}
        onRename={() => handleStartRename(listing)}
      />
    );
  }

  return (
    <Box>
      <DndContext
        sensors={sensors}
        collisionDetection={listCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {groups.map((group) => (
          <Box key={group.id}>
            {(groups.length > 1 || editable) && renderGroupHeader(group)}
            {editable && group.baseMaps.length === 0 && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  px: 2,
                  py: 0.75,
                  color: "panel.textMuted",
                  fontStyle: "italic",
                  borderBottom: "1px solid",
                  borderColor: "panel.border",
                }}
              >
                {emptyS}
              </Typography>
            )}
            <SortableContext
              items={group.baseMaps.map((map) => map.id)}
              strategy={verticalListSortingStrategy}
            >
              {group.baseMaps.map((map) => (
                <RowBaseMapInList
                  key={map.id}
                  id={map.id}
                  listingId={group.id}
                  name={map.name}
                  canDrag={Boolean(group.listing)}
                  onSelect={() => handleSelect(map)}
                  renaming={getRenamingProps(map, () =>
                    handleConfirmRenameBaseMap(map, group.listing)
                  )}
                  actions={
                    editable ? (
                      <IconButtonMoreActionsBaseMap
                        baseMap={map}
                        onOpenProperties={() => handleOpenProperties(map)}
                        onRename={() => handleStartRename(map)}
                        onAddVersion={() => setCreateVersionForBaseMap(map)}
                        sx={{ color: "panel.textLight", p: 0.25 }}
                      />
                    ) : null
                  }
                  {...getRowProps(map)}
                />
              ))}
            </SortableContext>
          </Box>
        ))}
        {/* Portal to body: the popper's CSS transform would offset the
            overlay's fixed positioning away from the pointer. */}
        {createPortal(
          <DragOverlay dropAnimation={null}>
            {activeDragBaseMap && (
              <Paper
                elevation={4}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                  py: 0.75,
                }}
              >
                <Typography variant="body2">
                  {activeDragBaseMap.name}
                </Typography>
              </Paper>
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>
      {/* "Visibilité auto" — not with the pinned grid (the rows are sheets,
          a click never changes the main base map there). */}
      {!pinned && (
        <>
          <Divider />
          <RowPanelOptionCheckbox
            label={autoVisibilityS}
            tooltip={autoVisibilityTooltipS}
            checked={autoBaseMapVisibility}
            onChange={(checked) => dispatch(setAutoBaseMapVisibility(checked))}
          />
        </>
      )}
      {isViewerModule && (
        <PopoverBaseMapVersions
          baseMap={mainBaseMap}
          anchorEl={versionsAnchorEl}
          onClose={() => setVersionsAnchorEl(null)}
        />
      )}
      {createVersionForBaseMap && (
        <DialogCreateBaseMapVersion
          open={Boolean(createVersionForBaseMap)}
          onClose={() => setCreateVersionForBaseMap(null)}
          onConfirm={handleCreateVersionFromDialog}
        />
      )}
    </Box>
  );
}

// Folder header of the list: name (uppercase caption), and in the editable
// list the "+" / "…" actions, the inline rename, and a DROP TARGET for a
// base map dragged from another folder (appended at its end).
function GroupHeader({
  group,
  droppable,
  isDropTarget,
  showActions,
  renaming, // null | { value, onChange, onConfirm, onCancel }
  newBaseMapS,
  onAddBaseMap,
  onRename,
}) {
  const listing = group.listing;

  // dnd

  const { setNodeRef } = useDroppable({
    id: `${GROUP_DROPPABLE_PREFIX}${group.id}`,
    data: { type: "group", listingId: group.id },
    disabled: !droppable,
  });

  // render

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        pl: 1,
        pr: 0.5,
        py: renaming ? 0.25 : showActions ? 0.125 : 0.5,
        bgcolor: isDropTarget ? "action.focus" : "panel.sectionBg",
        borderBottom: "1px solid",
        borderColor: "panel.border",
        ...(isDropTarget && {
          outline: "1px dashed",
          outlineColor: "primary.main",
          outlineOffset: -1,
        }),
      }}
    >
      {renaming ? (
        <>
          <InputBase
            value={renaming.value}
            onChange={(e) => renaming.onChange(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") renaming.onConfirm();
              else if (e.key === "Escape") renaming.onCancel();
            }}
            autoFocus
            sx={{ fontSize: "0.875rem", flex: 1, minWidth: 0 }}
          />
          <IconButton
            size="small"
            onClick={renaming.onConfirm}
            sx={{ color: "success.main", p: 0.25 }}
          >
            <Check sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={renaming.onCancel}
            sx={{ color: "error.main", p: 0.25 }}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </>
      ) : (
        <>
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              flex: 1,
              minWidth: 0,
              color: "panel.textMuted",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontSize: "11px",
            }}
          >
            {group.name}
          </Typography>
          {showActions && (
            <>
              <Tooltip title={newBaseMapS} disableInteractive>
                <IconButton
                  size="small"
                  onClick={onAddBaseMap}
                  sx={{ color: "panel.textLight", p: 0.25 }}
                >
                  <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <IconButtonMoreActionsBaseMapListing
                listing={listing}
                onRename={onRename}
                onAddBaseMap={onAddBaseMap}
                size="small"
                sx={{ color: "panel.textLight", p: 0.25, fontSize: 16 }}
              />
            </>
          )}
        </>
      )}
    </Box>
  );
}
