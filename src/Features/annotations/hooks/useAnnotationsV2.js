import { useMemo, useRef, useSyncExternalStore } from "react";
import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";

import { useSelector } from "react-redux";

// Module-level cache for listings (shared across all useAnnotationsV2 instances)
const _listingsCache = {
  key: null,
  listings: null,
  listingsMap: null,
  forBaseMapsListingIds: null,
};
// Invalidate cache when listings table changes
db.listings.hook("creating", () => {
  _listingsCache.key = null;
});
db.listings.hook("updating", () => {
  _listingsCache.key = null;
});
db.listings.hook("deleting", () => {
  _listingsCache.key = null;
});

// Module-level incremental cache for entities (keyed by table)
// Maps: table -> { idSet: Set<id>, cache: Map<id, entity> }
const _entitiesCache = {};
// Invalidate entity cache per table on updates/deletes
const _hookEntityTable = (tableName) => {
  if (!db[tableName]) return;
  try {
    db[tableName].hook("updating", (mods, primKey) => {
      if (_entitiesCache[tableName])
        _entitiesCache[tableName].cache.delete(primKey);
    });
    db[tableName].hook("deleting", (primKey) => {
      if (_entitiesCache[tableName])
        _entitiesCache[tableName].cache.delete(primKey);
    });
  } catch {
    /* hook already registered */
  }
};
const _hookedEntityTables = new Set();

// Last-warned count of annotations with unresolved (orphaned) point refs, so
// the "missing points" warning is emitted once per change instead of on every
// useLiveQuery re-run.
let _lastMissingPointsWarnCount = null;

// --- Shared stage-A IDB reads (issue #290) ---------------------------------
// Several useAnnotationsV2 instances (~6 in the map editor) re-run their
// liveQuery on every commit. Their filter signatures differ, so the final
// RESULT cannot be shared — but the raw IDB reads are identical across
// instances: the annotation rows (per base map / listing / project) and the
// point rows (by id). Without sharing, the concurrent heavy reads serialize
// on IndexedDB (measured "DB fetch" ramping from ~300ms to ~1.3s per commit
// with ~550 annotations). With these module caches, each read runs once per
// commit and follower instances reuse it. Full design + reactivity contract:
// docs/annotations/USE_ANNOTATIONS_V2.md
//
// Reactivity contract:
// - every liveQuery callback starts with cheap TRACKED reads
//   (db.annotations.count() + db.points.count()) so Dexie keeps re-running
//   each instance on any write to those tables, even when the instance only
//   consumed cached rows (an untracked follower would otherwise go blind);
// - same-tab writes invalidate synchronously via the Dexie hooks below
//   (hooks fire during the write, before any liveQuery re-run reads the
//   cache);
// - cross-tab writes don't fire table hooks: the global 'storagemutated'
//   event (which is also what re-triggers liveQuery across tabs) clears
//   everything, best effort;
// - the points cache carries a generation counter so a bulkGet resolving
//   AFTER an invalidation never writes its stale rows into the cache;
// - consumers COPY the shared annotations array before filtering/sorting;
//   the row objects themselves are treated as immutable downstream
//   (resolve/enrich steps all spread into new objects);
// - Dexie's overlap-based re-run signal is NOT sufficient on its own: the
//   scoped observation counts subscribe to an index range + :dels, never to
//   row primary keys, while an update that only touches NON-indexed fields
//   (annotation.points/cuts…, point x/y) marks ONLY the row's primary key —
//   no overlap, so follower instances (served from the shared caches, hence
//   without pk subscriptions of their own) would never re-run. The
//   _dbWriteTick below (bumped at commit time by the storagemutated
//   listener for annotations/points writes) is a React-side dep of every
//   instance's liveQuery, restoring the "every instance re-runs on every
//   annotations/points write" contract the pre-scoped unfiltered count()
//   used to provide.

// queryKey -> { promise, rows } — `rows` is set once the fetch resolves and
// is then PATCHED incrementally on every committed annotations write (see
// _recordAnnotationWrite below) instead of being refetched: the per-commit
// full range query (~200ms on heavy base maps / slow IDB) was the last big
// stage-A cost.
const _annotationsRowsCache = new Map();
const _pointsRowsCache = new Map(); // pointId -> row | null
const _pointsInflightFetches = new Map(); // pointId -> Promise<row | null>
let _pointsCacheGeneration = 0;
// Set by the table hooks below (they only fire for THIS tab's writes) and
// consumed by the storagemutated listener: a mutation event preceded by a
// local hook means the caches were already precisely invalidated — skipping
// the full clear preserves the points cache across local commits (clearing
// it forced a full ~N-thousand-point refetch on EVERY commit, which was the
// main source of IDB contention during drag/draw commits).
let _sawLocalWrite = false;

// Commit-time re-run signal (see "Reactivity contract" above): bumped by the
// storagemutated listener whenever a committed write touched db.annotations
// or db.points, and consumed by every hook instance as a liveQuery dep via
// useSyncExternalStore.
let _dbWriteTick = 0;
const _dbWriteTickListeners = new Set();
const _subscribeDbWriteTick = (cb) => {
  _dbWriteTickListeners.add(cb);
  return () => _dbWriteTickListeners.delete(cb);
};
const _getDbWriteTick = () => _dbWriteTick;
const _bumpDbWriteTick = () => {
  _dbWriteTick += 1;
  _dbWriteTickListeners.forEach((cb) => cb());
};
const useDbWriteTick = () =>
  useSyncExternalStore(_subscribeDbWriteTick, _getDbWriteTick);

// --- Incremental patching of the annotation-rows cache -------------------
// Instead of clearing the cache on every annotations write (which forced the
// next wave's leader to re-run the full range query), the hooks accumulate
// the touched primary keys PER ROOT TRANSACTION; on commit, ONE bulkGet
// re-reads the real rows (audit stamps included, soft-deletes visible) and
// patches every cached array according to its query scope. Batch writes
// (mass create / delete / update: bulkAdd, bulkPut, bulkDelete, procedure
// saves) therefore cost a single bulkGet + one array rebuild per cache
// entry, whatever the row count.
// A synchronous barrier makes any liveQuery re-run triggered by the same
// commit WAIT for the patch — otherwise it would read the pre-write rows
// and, with no further mutation, stay stale.
// Safety nets (fall back to a full clear → plain refetch): patch failure,
// oversized batches, hook fired without a transaction.
const _annPatchBarriers = new Set(); // pending patch promises (commit -> applied)
const _txAnnPatchState = new WeakMap(); // rootTx -> { keys: Set }
const MAX_PATCHED_KEYS = 500;

const _annCacheFullClear = () => {
  _annotationsRowsCache.clear();
};

function _rowBelongsToQueryKey(queryKey, row) {
  if (!row) return false;
  const sep = queryKey.indexOf(":");
  const kind = queryKey.slice(0, sep);
  const val = queryKey.slice(sep + 1);
  if (kind === "baseMaps") return val.split(",").includes(row.baseMapId);
  if (kind === "listing") return row.listingId === val;
  // projectId is numeric on the row but the queryKey segment is a string
  // ("project:" + projectId): compare as strings so the patched row is
  // re-added to the project-scoped cache instead of being silently dropped.
  if (kind === "project") return String(row.projectId) === val;
  return false;
}

function _patchRowsArray(rows, keys, freshById, queryKey) {
  const keySet = new Set(keys);
  const next = rows.filter((r) => !keySet.has(r.id));
  for (const k of keys) {
    const fresh = freshById.get(k);
    if (fresh && !fresh.deletedAt && _rowBelongsToQueryKey(queryKey, fresh)) {
      next.push(fresh);
    }
  }
  return next;
}

async function _applyAnnotationRowPatches(keys) {
  const freshRows = await db.annotations.bulkGet(keys);
  const freshById = new Map(keys.map((k, i) => [k, freshRows[i]]));
  for (const [queryKey, entry] of _annotationsRowsCache) {
    if (entry.rows) {
      entry.rows = _patchRowsArray(entry.rows, keys, freshById, queryKey);
    } else {
      // initial fetch still in flight (its snapshot may predate this
      // commit): chain the patch after it resolves.
      entry.promise = entry.promise.then((rows) => {
        entry.rows = _patchRowsArray(
          entry.rows ?? rows,
          keys,
          freshById,
          queryKey
        );
        return entry.rows;
      });
    }
  }
}

function _recordAnnotationWrite(primKey, tx) {
  _sawLocalWrite = true;
  if (!tx) {
    // no transaction context (should not happen — Dexie wraps every
    // mutation): stay correct with a plain clear.
    _annCacheFullClear();
    return;
  }
  // Nested Dexie transactions share the parent's IDB commit — buffer and
  // subscribe on the ROOT transaction only.
  let root = tx;
  while (root.parent) root = root.parent;
  let state = _txAnnPatchState.get(root);
  if (!state) {
    state = { keys: new Set() };
    _txAnnPatchState.set(root, state);
    let release;
    const barrier = new Promise((resolve) => {
      release = resolve;
    });
    _annPatchBarriers.add(barrier);
    const done = () => {
      _annPatchBarriers.delete(barrier);
      release();
    };
    root.on("complete", () => {
      if (state.keys.size > MAX_PATCHED_KEYS) {
        _annCacheFullClear();
        done();
        return;
      }
      _applyAnnotationRowPatches([...state.keys])
        .catch(() => _annCacheFullClear())
        .finally(done);
    });
    root.on("abort", done); // nothing was applied — cache still valid
  }
  state.keys.add(primKey);
}

db.annotations.hook("creating", (primKey, obj, tx) =>
  _recordAnnotationWrite(primKey, tx)
);
db.annotations.hook("updating", (mods, primKey, obj, tx) =>
  _recordAnnotationWrite(primKey, tx)
);
db.annotations.hook("deleting", (primKey, obj, tx) =>
  _recordAnnotationWrite(primKey, tx)
);
db.points.hook("creating", (primKey) => {
  // A point id can be negatively cached (null = "no such row") when a read
  // raced its creation — drop the stale null so the row becomes visible.
  _sawLocalWrite = true;
  _pointsCacheGeneration += 1;
  _pointsRowsCache.delete(primKey);
});
db.points.hook("updating", (mods, primKey) => {
  _sawLocalWrite = true;
  _pointsCacheGeneration += 1;
  _pointsRowsCache.delete(primKey);
});
db.points.hook("deleting", (primKey) => {
  _sawLocalWrite = true;
  _pointsCacheGeneration += 1;
  _pointsRowsCache.delete(primKey);
});
// Other tables' local writes also fire storagemutated: flag them too so the
// listener below doesn't wipe the caches for unrelated local commits.
["listings", "layers", "files", "annotationTemplates", "entities"].forEach(
  (t) => {
    try {
      db[t]?.hook("creating", () => {
        _sawLocalWrite = true;
      });
      db[t]?.hook("updating", () => {
        _sawLocalWrite = true;
      });
      db[t]?.hook("deleting", () => {
        _sawLocalWrite = true;
      });
    } catch {
      /* table may not exist */
    }
  }
);

try {
  // Fires on every committed write, including from other tabs (it is the
  // same signal Dexie uses to re-run liveQueries cross-tab). Local writes
  // were already precisely invalidated by the hooks above (which run first,
  // synchronously during the write) — only foreign (cross-tab) mutations
  // need the full clear.
  Dexie.on("storagemutated", (parts) => {
    if (_sawLocalWrite) {
      _sawLocalWrite = false;
    } else {
      _annotationsRowsCache.clear();
      _pointsCacheGeneration += 1;
      _pointsRowsCache.clear();
    }
    // Part keys look like `idb://<dbName>/<tableName>/<indexName>` — bump the
    // re-run tick only for writes touching the tables this hook resolves.
    // A missing parts payload is treated as "may touch anything".
    const touchesObservedTables =
      !parts ||
      Object.keys(parts).some(
        (k) =>
          k.startsWith(`idb://${db.name}/annotations/`) ||
          k.startsWith(`idb://${db.name}/points/`)
      );
    if (touchesObservedTables) _bumpDbWriteTick();
  });
} catch {
  // best effort — same-tab hooks above remain the primary invalidation
}

// Per-annotation RESOLVE memo (module-level, shared across hook instances
// and runs). The geometric resolution of one annotation — resolvePoints /
// resolveCuts / guideLine resolve + slope ramp (applyGuideLineRampToRings)
// + stage-A qties — is a pure function of: the annotation row, its
// referenced point rows, the base map's imageSize/meterByPx. All of those
// are referentially STABLE thanks to the shared row caches above, so the
// memo is keyed on object identity: an unchanged annotation reuses its
// resolved output as-is, and a commit only recomputes the annotations whose
// row or point rows actually changed. Without this, every liveQuery re-run
// re-resolved ALL annotations in EVERY mounted instance — measured at
// 280-800ms of main-thread JS per instance on a ~550-annotation base map
// (the per-annotation resolve work compounds across the ~7 interleaved
// instances, whatever the dominant sub-cost: qties, ramps, cuts…).
// Entries die with their annotation row (WeakMap): any annotation write
// refetches rows → new row objects → old entries are GC'd.
// `variants` holds one resolved object per withQties flag value (instances
// differ on it; a single slot would thrash between instance families).
const _resolvedRowsCache = new WeakMap(); // annotationRow -> entry

const _collectPointRowRefs = (annotation, pointsIndex) => {
  const refs = [];
  const push = (p) => {
    const id = p?.id ?? p?.pointId;
    if (id) refs.push(pointsIndex[id]);
  };
  if (annotation?.point) push(annotation.point);
  (annotation?.points ?? []).forEach(push);
  (annotation?.cuts ?? []).forEach((c) => (c?.points ?? []).forEach(push));
  (annotation?.innerPoints ?? []).forEach(push);
  (annotation?.guideLines ?? []).forEach((g) =>
    (g?.points ?? []).forEach(push)
  );
  (annotation?.isoHeightLines ?? []).forEach((l) =>
    (l?.points ?? []).forEach(push)
  );
  (annotation?.profileLines ?? []).forEach((l) =>
    (l?.points ?? []).forEach(push)
  );
  return refs;
};

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBgImageTextAnnotations from "Features/bgImage/hooks/useBgImageTextAnnotations";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import collectReferencedPointIds from "Features/annotations/utils/collectReferencedPointIds";
import resolvePoints from "Features/annotations/utils/resolvePoints";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import getAnnotationFootprintOnBaseMap from "Features/threedEditor/js/utilsAnnotationsManager/getAnnotationFootprintOnBaseMap";
import { FOREIGN_FOOTPRINT_ID_PREFIX } from "Features/annotations/constants/foreignFootprint";
import { PHOTO_ID_PREFIX } from "Features/photos/constants/photoNode";
import resolveCuts from "Features/annotations/utils/resolveCuts";
import resolveGuideLine from "Features/annotations/utils/resolveGuideLine";
import resolveProfileLine from "Features/annotations/utils/resolveProfileLine";
import applyGuideLineRampToRings from "Features/annotations/utils/applyGuideLineRampToRings";
import {
  SEGMENT_FLAG_FIELDS,
  getAnnotationRingClosed,
  getRingSegmentFlagPointIds,
  segmentPointIdsToIdx,
  hasAnySegmentFlagField,
} from "Features/annotations/utils/segmentFlags";
import applyIsoHeightLinesToRings from "Features/annotations/utils/applyIsoHeightLinesToRings";
import applyProfileEndpointContinuity from "Features/annotations/utils/applyProfileEndpointContinuity";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import stabilizeAnnotationsIdentity from "Features/annotations/utils/stabilizeAnnotationsIdentity";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getAnnotationPropsFromAnnotationTemplateProps from "Features/annotations/utils/getAnnotationPropsFromAnnotationTemplateProps";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import getAnnotationSubtractionQties from "Features/annotations/utils/getAnnotationSubtractionQties";
import getAnnotationOpeningQties from "Features/annotations/utils/getAnnotationOpeningQties";
import useAnnotationOpenings from "Features/annotations/hooks/useAnnotationOpenings";
import getExtrusionProfileFootprintShapes from "Features/annotations/utils/getExtrusionProfileFootprintShapes";
import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import useZoneSoloAnnotationIdSet from "Features/zonings/hooks/useZoneSoloAnnotationIdSet";
import useBusinessObjectSoloAnnotationIdSet from "Features/businessObjects/hooks/useBusinessObjectSoloAnnotationIdSet";
import useMainBusinessObjectLabelByAnnotationId from "Features/businessObjects/hooks/useMainBusinessObjectLabelByAnnotationId";
import { selectPovFreezeCreatedBefore } from "Features/viewers/utils/effectiveViewerKey";
import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";
import {
  isRevolutionHelperType,
  isLegacyRevolutionRecord,
  isLegacyStyleRevolutionHelper,
} from "Features/annotations/constants/drawingShapeConfig";
import { resolveProfileFromDb } from "Features/annotations/hooks/useProfileResolution";
import computeSubtractedSurfaceM2Async from "Features/threedEditor/js/utilsAnnotationsManager/computeSubtractedSurfaceM2Async";
import getPhotoPlanAttachment from "Features/photoPlans/utils/getPhotoPlanAttachment";
import mapPhotoPointsToPlane from "Features/photoPlans/utils/mapPhotoPointsToPlane";
import getRevolutionPhi from "Features/threedEditor/js/utilsAnnotationsManager/getRevolutionPhi";
import getRevolutionAxisPlanFrame from "Features/annotations/utils/getRevolutionAxisPlanFrame";

// Length of the synthesized lathe-axis segment, in reference-frame pixels. The
// value is arbitrary: both ends share the same x (all buildRevolutionMesh reads
// is mean(x)) and `baseY` cancels out for a VERTICAL base map.
const AXIS_SYNTH_SPAN_PX = 100;

const DEG_TO_RAD = Math.PI / 180;

// Sector kept by a partial revolution, resolved from the AXIS (shared by every
// arc bound to it). Returns null for a full turn, so the camera-driven 180°
// half-view stays in charge when the user hasn't set explicit angles.
function getRevolutionPhiForAxis(axis) {
  if (!axis?.partialRevolution) return null;
  const theta =
    (Number(axis.directionDeg) || 0) * DEG_TO_RAD +
    (axis.invertHalf ? Math.PI : 0);
  return getRevolutionPhi(
    (Number(axis.revolutionAngleStartDeg) || 0) * DEG_TO_RAD,
    (Number(axis.revolutionAngleEndDeg) || 0) * DEG_TO_RAD,
    theta
  );
}

export default function useAnnotationsV2(options) {
  try {
    // options

    const _caller = options?.caller || "unknown";
    const enabled = options?.enabled ?? true;

    // Per-instance identity cache (NOT module-level: options like
    // withEntity/withQties/withListingName change the shape of the output
    // objects, so instances must never share cached references).
    const stabilityRef = useRef(null);
    if (!stabilityRef.current) {
      stabilityRef.current = { byId: new Map(), prevArray: null };
    }

    const filterByBaseMapId = options?.filterByBaseMapId;
    const filterByListingId = options?.filterByListingId;

    // Additional base maps whose annotations should be loaded alongside the
    // primary one (used by the 3D viewer to show other base maps'
    // annotations). Each annotation is resolved against its own base map
    // (via `baseMapById`) further down, so geometry stays correct.
    const extraBaseMapIds = options?.extraBaseMapIds || [];
    const extraBaseMapIdsKey = extraBaseMapIds.join("-");

    // Opt-in: append read-only "footprint" annotations for the subtraction
    // targets hosted by ANOTHER base map (see FOREIGN_FOOTPRINT_ID_PREFIX).
    // Only the 2D renderer and useSelectedAnnotation ask for them — every
    // quantity / listing / export caller must keep ignoring them.
    const withForeignFootprints = options?.withForeignFootprints;

    // Opt-in: append read-only PHOTO pseudo-annotations from db.photos
    // (Photos module map rendering — see PHOTO_ID_PREFIX). Every quantity /
    // listing / export caller must keep ignoring them.
    const withPhotos = options?.withPhotos;

    const filterBySelectedScope = options?.filterBySelectedScope;
    const filterByMainBaseMap = options?.filterByMainBaseMap;
    const filterBySelectedListing = options?.filterBySelectedListing;

    const excludeListingsIds = options?.excludeListingsIds;
    const excludeBgAnnotations = options?.excludeBgAnnotations;

    const withEntity = options?.withEntity;
    const withListingName = options?.withListingName;
    const withQties = options?.withQties;

    const baseMapAnnotationsOnly = options?.baseMapAnnotationsOnly;
    const hideBaseMapAnnotations = options?.hideBaseMapAnnotations;

    const groupByBaseMap = options?.groupByBaseMap;
    const sortByOrderIndex = options?.sortByOrderIndex;
    // Exclude annotations whose annotationTemplate is a "profile"
    // (template.isProfile === true). Used by the 3D viewer so profile
    // annotations stay visible in 2D but are dropped from the 3D scene.
    const excludeProfileTemplates = options?.excludeProfileTemplates;
    const excludeIsForBaseMapsListings = options?.excludeIsForBaseMapsListings;
    const onlyIsForBaseMapsListings = options?.onlyIsForBaseMapsListings;
    // In the 3D viewer, keep non-soloed annotations in the result (instead of
    // removing them) so ThreedSelectionDimmer can render them translucent
    // rather than hiding them outright (zone solo — zonings module).
    const keepSoloDimmed = options?.keepSoloDimmed;
    // Skip the zone-solo filter entirely. Used by the listings panel, which
    // needs a solo-independent set of visible annotations (soloing a zone must
    // not remove rows from the panel tree or shrink its counts).
    const ignoreSolo = options?.ignoreSolo;
    // Keep annotations whose template is hidden (they carry `hidden: true` so
    // callers can re-filter locally). Used by the listings panel to keep
    // eye-hidden template rows in the tree so they can be re-enabled.
    const keepHiddenTemplates = options?.keepHiddenTemplates;

    // data

    const appConfig = useAppConfig();

    const projectId = useSelector((s) => s.projects.selectedProjectId);
    const selectedListingId = useSelector((s) => s.listings.selectedListingId);
    const { value: scope } = useSelectedScope();
    const baseMap = useMainBaseMap();

    const annotationTemplates = useAnnotationTemplates();
    const annotationTemplatesMap = useMemo(
      () => getItemsByKey(annotationTemplates, "id"),
      [annotationTemplates]
    );

    const tempAnnotations = useSelector((s) => s.annotations.tempAnnotations);

    const bgImageTextAnnotations = useBgImageTextAnnotations();

    // NOTE: the Redux `annotationsUpdatedAt` tick is intentionally NOT a
    // dependency of the liveQuery below. Dexie's liveQuery natively observes
    // every table read inside the callback (db.annotations, db.points,
    // db.listings, db.layers, db.files, db.annotationTemplates, entity
    // tables), including bulk writes and _skipOwnershipGuard/system writes —
    // keeping the tick as a dep made every commit run the query twice.
    //
    // The module-level _dbWriteTick IS a dep though: Dexie's native overlap
    // check misses updates that only change non-indexed fields on rows this
    // instance consumed from the shared caches (see "Reactivity contract" in
    // the module header), so every committed annotations/points write must
    // force a re-run from the React side.

    const dbWriteTick = useDbWriteTick();

    // Restored POV: the view is frozen at its generation date (null otherwise).
    const povFreezeCreatedBefore = useSelector(selectPovFreezeCreatedBefore);

    const hiddenLayerIds = useSelector((s) => s.layers?.hiddenLayerIds || []);
    const showAnnotationsWithoutLayer = useSelector(
      (s) => s.layers?.showAnnotationsWithoutLayer ?? true
    );
    const layersUpdatedAt = useSelector((s) => s.layers?.layersUpdatedAt);

    const listingsUpdatedAt = useSelector((s) => s.listings.listingsUpdatedAt);
    // Redux mirror of db.listings (dexieSyncService liveQuery) — used by the
    // sortByOrderIndex block for listing ranks: unlike _listingsCache (only
    // refreshed when THIS hook's liveQuery re-runs, i.e. on annotations/points
    // writes), it updates on any db.listings write, so a rank reorder
    // (FieldActiveListing drag) re-sorts the z-order immediately.
    const listingsById = useSelector((s) => s.listings.listingsById);

    // zone SOLO (zonings module): {zoneId, listingId, templateId} | null.
    // Applies in every interaction mode, DRAW included.
    const soloZone = useSelector((s) => s.zonings?.soloZone ?? null);
    const zoneSoloAnnotationIdSet = useZoneSoloAnnotationIdSet(
      soloZone?.zoneId
    );

    // business-object SOLO (Ouvrages module): clicking an object shows only
    // the annotations linked to it or to its descendants. Same ignoreSolo /
    // keepSoloDimmed semantics as the zone solo.
    const soloBusinessObjectId = useSelector(
      (s) => s.businessObjects?.selectedBusinessObjectId ?? null
    );
    const businessObjectSoloAnnotationIdSet =
      useBusinessObjectSoloAnnotationIdSet(soloBusinessObjectId);

    // "located" business objects: the MAIN annotation of an object displays
    // the object's label everywhere (2D chip, 3D sprite, panels). Content-
    // keyed Map (stable identity while nothing changes).
    const mainBusinessObjectLabelByAnnotationId =
      useMainBusinessObjectLabelByAnnotationId();

    // template FOCUS (Dessin module's recap panel): templateId | null. Same
    // ignoreSolo / keepSoloDimmed semantics as the zone solo.
    const soloTemplateId = useSelector(
      (s) => s.annotations?.soloAnnotationTemplateId ?? null
    );
    // single-annotation FOCUS (panel annotation detail "Isoler"): same
    // semantics, keyed on the annotation id.
    const soloAnnotationId = useSelector(
      (s) => s.annotations?.soloAnnotationId ?? null
    );

    const { targetIdsBySource: subtractionTargetIdsBySource } =
      useAnnotationSubtractions();

    const { rowsByHostId: openingRowsByHostId } = useAnnotationOpenings();

    const { value: baseMaps, baseMapsUpdatedAt } = useBaseMaps({
      // by-id join: annotations drawn ON a detail baseMap must resolve it
      includeDetails: true,
    });
    const baseMapById = useMemo(
      () => getItemsByKey(baseMaps, "id"),
      [baseMaps]
    );

    // helper - selected items

    const baseMapId =
      filterByMainBaseMap || baseMapAnnotationsOnly
        ? baseMap?.id
        : filterByBaseMapId;
    const listingId = filterBySelectedListing
      ? selectedListingId
      : filterByListingId;

    // main
    let annotations = useLiveQuery(async () => {
      // skip computation when disabled
      if (!enabled) return [];

      // edge case
      if (!baseMaps || !projectId) return null;

      const _tStart = performance.now();

      // Shared-read caches (see module header): keep this instance's
      // liveQuery OBSERVING db.annotations and db.points even when every
      // heavy read below is served from cache — Dexie only re-runs a
      // liveQuery on writes to tables its callback actually read.
      // The observation reads are SCOPED to the ranges this instance
      // consumes (same semantics as the pre-#290 direct reads): an
      // unfiltered count() scanned the WHOLE table across every project,
      // which on large multi-project local DBs cost ~100ms+ per call.
      // They are also MINIMAL — limit(1).primaryKeys() — because Dexie
      // registers the queried RANGE for observation regardless of limit,
      // while count() walks the whole index range: with 7 instances × 2
      // reads all firing on the same commit, the counts serialized on IDB
      // for ~500ms per wave on slow-IDB machines.
      // And they are OFF the critical path: observation registers when the
      // read is ISSUED (inside this liveQuery zone), so the promise is only
      // awaited at the very end of the callback — the reads run in parallel
      // with the shared-cache work instead of gating it.
      let _obsDoneAt = 0;
      const _obsPromise = (async () => {
        const obsBaseMapIds = [baseMapId, ...extraBaseMapIds].filter(Boolean);
        if (obsBaseMapIds.length > 0) {
          await Promise.all([
            db.annotations
              .where("baseMapId")
              .anyOf(obsBaseMapIds)
              .limit(1)
              .primaryKeys(),
            db.points
              .where("baseMapId")
              .anyOf(obsBaseMapIds)
              .limit(1)
              .primaryKeys(),
          ]);
        } else if (listingId) {
          await Promise.all([
            db.annotations
              .where("listingId")
              .equals(listingId)
              .limit(1)
              .primaryKeys(),
            db.points
              .where("listingId")
              .equals(listingId)
              .limit(1)
              .primaryKeys(),
          ]);
        } else {
          await Promise.all([
            db.annotations
              .where("projectId")
              .equals(projectId)
              .limit(1)
              .primaryKeys(),
            db.points
              .where("projectId")
              .equals(projectId)
              .limit(1)
              .primaryKeys(),
          ]);
        }
        _obsDoneAt = performance.now();
      })();
      // Suppress unhandled-rejection noise if the callback throws elsewhere
      // first; the await at the end still propagates a real obs failure.
      _obsPromise.catch(() => {});

      const _t0 = performance.now();
      const _obsMs = () => (_obsDoneAt ? _obsDoneAt - _tStart : NaN);
      // annotations

      // NOTE: points are fetched AFTER all annotation filtering (below), by
      // primary key, for only the point ids the surviving annotations actually
      // reference. Fetching by `baseMapId`/`projectId` used to pull the entire
      // points table for the base map — which accumulates thousands of
      // orphaned (never-deleted) rows — even though only the referenced ~N are
      // used to build `pointsIndex`. See buildPointsIndexForAnnotations below.
      // Annotation rows come from the shared module cache: the first
      // instance to run a given query stores the PROMISE, followers await
      // the same one. The array is copied per instance (downstream filters
      // reassign, and the layers block sorts in place); row objects are
      // never mutated downstream.
      let _annRowsSharedHit = false;
      const _annRowsFromShared = async (queryKey, fetcher) => {
        // Wait for any pending commit patch (see _recordAnnotationWrite):
        // a re-run triggered by that very commit must read the patched
        // rows, not the pre-write ones.
        while (_annPatchBarriers.size > 0) {
          await Promise.all([..._annPatchBarriers]);
        }
        let entry = _annotationsRowsCache.get(queryKey);
        _annRowsSharedHit = Boolean(entry);
        if (!entry) {
          entry = { rows: null, promise: null };
          entry.promise = fetcher()
            .then((rows) => {
              entry.rows = rows;
              return rows;
            })
            .catch((e) => {
              _annotationsRowsCache.delete(queryKey);
              throw e;
            });
          _annotationsRowsCache.set(queryKey, entry);
        }
        // entry.promise can be extended by a patch chaining onto an
        // in-flight fetch — await until it settles on a stable value.
        let p;
        do {
          p = entry.promise;
          await p;
        } while (entry.promise !== p);
        return [...(entry.rows ?? [])];
      };

      let _annotations;
      if (baseMapId) {
        // Primary base map + any extra base maps (3D viewer), deduped.
        const queryBaseMapIds = [baseMapId, ...extraBaseMapIds].filter(
          (v, i, arr) => v && arr.indexOf(v) === i
        );
        _annotations = await _annRowsFromShared(
          "baseMaps:" + [...queryBaseMapIds].sort().join(","),
          async () =>
            (
              await db.annotations
                .where("baseMapId")
                .anyOf(queryBaseMapIds)
                .toArray()
            ).filter((r) => !r.deletedAt)
        );
      }

      if (listingId) {
        if (!_annotations) {
          _annotations = await _annRowsFromShared(
            "listing:" + listingId,
            async () =>
              (
                await db.annotations
                  .where("listingId")
                  .equals(listingId)
                  .toArray()
              ).filter((r) => !r.deletedAt)
          );
        } else {
          _annotations = _annotations.filter((a) => a.listingId === listingId);
        }

        // remove base map annotations
        _annotations = _annotations.filter((a) => !a.isBaseMapAnnotation);
      }

      if (!listingId && !baseMapId) {
        _annotations = await _annRowsFromShared(
          "project:" + projectId,
          async () =>
            (
              await db.annotations
                .where("projectId")
                .equals(projectId)
                .toArray()
            ).filter((r) => !r.deletedAt)
        );
      }

      const _t1 = performance.now();
      // base map annotations

      if (baseMapAnnotationsOnly) {
        _annotations = _annotations.filter((a) => a.isBaseMapAnnotation);
      }

      if (hideBaseMapAnnotations) {
        _annotations = _annotations.filter((a) => !a.isBaseMapAnnotation);
      }

      // Drop the rows of the previous revolution-axis model before anything
      // tries to resolve them: a legacy axis has `points` but no centre
      // `point`, which the single-point branch below cannot resolve. Note that
      // a throw there is NOT visible as itself — the whole hook body sits in a
      // try/catch, so it would surface as a React hook-order crash in whatever
      // component calls this hook.
      _annotations = _annotations.filter((a) => !isLegacyRevolutionRecord(a));

      // Eye toggle of the placement banner (tools panel): the record-level
      // `hidden` flag must be applied BEFORE the template merge — for
      // template-linked helpers the merge would clobber it with the template's
      // own (possibly false) `hidden`, and legacy helpers bypass every
      // visibility filter below anyway. Display-only: the revolution
      // resolution reads the axis and its placement straight from Dexie, so a
      // hidden axis still drives its lathes and still poses its base map.
      _annotations = _annotations.filter(
        (a) => !(isRevolutionHelperType(a.type) && a.hidden)
      );

      // Template-linked revolution helpers are normal listing annotations and
      // flow through the visibility filters below. Only rows written by the
      // pre-template model (no annotationTemplateId, scopeId instead of a
      // listingId) keep the historical global-visibility bypass.
      const isRevolutionHelper = (a) => isLegacyStyleRevolutionHelper(a);

      // layer visibility filter
      if (hiddenLayerIds.length > 0 || !showAnnotationsWithoutLayer) {
        _annotations = _annotations.filter((a) => {
          if (a.isBaseMapAnnotation || isRevolutionHelper(a)) return true;
          if (!a.layerId) return showAnnotationsWithoutLayer;
          return !hiddenLayerIds.includes(a.layerId);
        });
      }

      // POV freeze: a restored view shows its content AS OF its generation
      // date, so it stays faithful to the saved image — annotations created
      // later are dropped. createdAt is an ISO string (audit hook), plain
      // string comparison is correct; rows without one (legacy / temp) stay.
      if (povFreezeCreatedBefore) {
        _annotations = _annotations.filter(
          (a) => !a.createdAt || a.createdAt <= povFreezeCreatedBefore
        );
      }

      const _t2 = performance.now();
      // -- LISTINGS (with module-level cache) --

      const listingsIds = [
        ...new Set(_annotations.map((a) => a.listingId).filter(Boolean)),
      ];
      const _t2a = performance.now();
      const listingsCacheKey = listingsIds.sort().join(",");
      let listings, listingsMap, forBaseMapsListingIds;
      if (_listingsCache.key === listingsCacheKey) {
        // Cache hit — skip DB query
        listings = _listingsCache.listings;
        listingsMap = _listingsCache.listingsMap;
        forBaseMapsListingIds = _listingsCache.forBaseMapsListingIds;
      } else {
        // Cache miss — fetch from DB and update cache
        listings = await db.listings.where("id").anyOf(listingsIds).toArray();
        listingsMap = getItemsByKey(listings, "id");
        forBaseMapsListingIds = new Set(
          listings.filter((l) => l.isForBaseMaps).map((l) => l.id)
        );
        _listingsCache.key = listingsCacheKey;
        _listingsCache.listings = listings;
        _listingsCache.listingsMap = listingsMap;
        _listingsCache.forBaseMapsListingIds = forBaseMapsListingIds;
      }
      const _t2b = performance.now();

      if (excludeIsForBaseMapsListings) {
        _annotations = _annotations.filter(
          (a) =>
            isRevolutionHelper(a) || !forBaseMapsListingIds.has(a.listingId)
        );
      }

      if (onlyIsForBaseMapsListings) {
        _annotations = _annotations.filter((a) =>
          forBaseMapsListingIds.has(a.listingId)
        );
      }

      // -- SCOPE FILTER --

      if (filterBySelectedScope && scope?.id) {
        const scopeListingIds = new Set(
          listings
            .filter((l) => {
              const em = appConfig?.entityModelsObject?.[l.entityModelKey];
              return (
                em?.type === "BASE_MAP" ||
                em?.type === "PHOTO" ||
                l.scopeId === scope?.id
              );
            })
            .map((l) => l.id)
        );
        _annotations = _annotations.filter((a) => {
          if (a.isBaseMapAnnotation) return true;
          // Pre-template revolution helpers carry no listing (it would pollute
          // the listing counters) — they are scoped by their own `scopeId`
          // instead. Rows written before that field existed have none: keep
          // them rather than making them vanish.
          if (isRevolutionHelper(a))
            return !a.scopeId || a.scopeId === scope.id;
          return scopeListingIds.has(a.listingId);
        });
      }

      // -- LISTING EXCLUSIONS --

      if (excludeListingsIds && !baseMapAnnotationsOnly) {
        _annotations = _annotations.filter(
          (a) =>
            isRevolutionHelper(a) || !excludeListingsIds.includes(a.listingId)
        );
      }

      if (baseMapAnnotationsOnly) {
        _annotations = _annotations.filter((a) => a.isBaseMapAnnotation);
      }

      // layer sort order — first layer's annotations drawn on top (last in array)
      const _t2c = performance.now();
      if (baseMapId) {
        const layers = (
          await db.layers.where("baseMapId").equals(baseMapId).toArray()
        )
          .filter((l) => !l.deletedAt)
          .sort((a, b) => {
            const ai = a.orderIndex ?? "";
            const bi = b.orderIndex ?? "";
            return ai < bi ? -1 : ai > bi ? 1 : 0;
          });
        if (layers.length > 0) {
          const layerOrder = {};
          layers.forEach((l, i) => {
            layerOrder[l.id] = i;
          });
          const maxOrder = layers.length;
          _annotations = _annotations.sort((a, b) => {
            if (a.isBaseMapAnnotation !== b.isBaseMapAnnotation) {
              return a.isBaseMapAnnotation ? -1 : 1;
            }
            const orderA = a.layerId
              ? (layerOrder[a.layerId] ?? maxOrder)
              : maxOrder + 1;
            const orderB = b.layerId
              ? (layerOrder[b.layerId] ?? maxOrder)
              : maxOrder + 1;
            // first layer (index 0) = bottom = first in array
            return orderA - orderB;
          });
        }
      }

      const _t3 = performance.now();
      // add images (only for IMAGE and MARKER annotations) — batched
      if (_annotations) {
        const imageAnnotations = _annotations.filter(
          (a) => a.type === "IMAGE" || a.type === "MARKER"
        );
        if (imageAnnotations.length > 0) {
          // Collect all fileNames needed
          const fileNames = new Set();
          for (const a of imageAnnotations) {
            if (Array.isArray(a.images))
              a.images.forEach((img) => {
                if (img?.fileName) fileNames.add(img.fileName);
              });
            for (const [key, val] of Object.entries(a)) {
              if (
                key !== "images" &&
                val &&
                typeof val === "object" &&
                val.isImage &&
                val.fileName
              )
                fileNames.add(val.fileName);
            }
          }
          // Batch fetch all files at once
          const filesArray =
            fileNames.size > 0
              ? await db.files
                  .where("fileName")
                  .anyOf([...fileNames])
                  .toArray()
              : [];
          const filesMap = {};
          for (const f of filesArray) {
            filesMap[f.fileName] = f;
          }

          _annotations = await Promise.all(
            _annotations.map(async (annotation) => {
              if (annotation.type !== "IMAGE" && annotation.type !== "MARKER")
                return annotation;
              const { entityWithImages } = await getEntityWithImagesAsync(
                annotation,
                filesMap
              );
              return { ...entityWithImages };
            })
          );
        }
      }

      const _t4 = performance.now();
      // points
      //
      // Fetch only the point rows referenced by the surviving annotations,
      // keyed by primary id (bulkGet — direct key lookups, no index scan). The
      // previous `.where("baseMapId"/"projectId")` fetch pulled the whole
      // points table (tens of thousands of orphaned, never-deleted rows) just
      // to build an index over the ~N points actually used here. Reactivity is
      // preserved: bulkGet observes exactly these keys, and any annotation
      // change re-runs this query and re-collects ids.
      // Point rows go through the shared per-id module cache: only ids not
      // yet cached (nor already being fetched by a sibling instance of the
      // same commit) hit IndexedDB. The generation guard drops a bulkGet
      // that resolved after an invalidation, so stale rows never enter the
      // cache; the write that caused the invalidation re-triggers every
      // liveQuery anyway.
      const referencedPointIds = collectReferencedPointIds(_annotations);
      let _pointsFetchedFromDb = 0;
      const points = [];
      if (referencedPointIds.size > 0) {
        const missingIds = [];
        const rowById = new Map();
        const waits = [];
        for (const id of referencedPointIds) {
          if (_pointsRowsCache.has(id)) {
            rowById.set(id, _pointsRowsCache.get(id));
          } else if (!_pointsInflightFetches.has(id)) {
            missingIds.push(id);
          }
        }
        if (missingIds.length > 0) {
          _pointsFetchedFromDb = missingIds.length;
          const generation = _pointsCacheGeneration;
          const fetchPromise = db.points
            .bulkGet(missingIds)
            .then((rows) => {
              if (generation === _pointsCacheGeneration) {
                missingIds.forEach((id, i) =>
                  _pointsRowsCache.set(id, rows[i] ?? null)
                );
              }
              return rows;
            })
            .finally(() => {
              missingIds.forEach((id) => _pointsInflightFetches.delete(id));
            });
          missingIds.forEach((id, i) =>
            _pointsInflightFetches.set(
              id,
              fetchPromise.then((rows) => rows[i] ?? null)
            )
          );
        }
        // NB: no await between the scan above and this loop — every id is
        // either in rowById already or has an in-flight promise.
        for (const id of referencedPointIds) {
          if (rowById.has(id)) continue;
          const inflight = _pointsInflightFetches.get(id);
          if (inflight)
            waits.push(inflight.then((row) => rowById.set(id, row)));
        }
        await Promise.all(waits);
        for (const id of referencedPointIds) {
          const row = rowById.get(id);
          if (row && !row.deletedAt) points.push(row);
        }
      }

      const pointsIndex = getItemsByKey(points, "id");
      // Corrupted point refs (orphaned — the referenced db.points row is
      // missing). resolvePoints leaves such refs without x/y: we drop them from
      // the resolved geometry so the annotation still renders with its valid
      // points, and record the dropped ids in annotation.corruptedPointIds
      // (in-memory only — the DB record keeps the refs, so the annotation
      // heals itself if the points reappear via sync/import).
      let _missingPointsAnnCount = 0;
      let _resolveMemoHits = 0;
      const _isResolved = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
      const _splitResolved = (pts, corruptedIds) => {
        if (!Array.isArray(pts)) return pts;
        return pts.filter((p) => {
          if (_isResolved(p)) return true;
          const id = p?.id ?? p?.pointId;
          if (id) corruptedIds.push(id);
          return false;
        });
      };
      _annotations = _annotations
        .filter((a) => a.baseMapId)
        .map((annotation) => {
          const _annotation = {
            ...annotation,
          };

          const corruptedIds = [];

          let annotationPoints = annotation?.points;

          const baseMap = baseMapById[annotation.baseMapId];
          const imageSize =
            baseMap?.getImageSize?.() || baseMap?.image?.imageSize;

          if (!imageSize) return [];
          const { width, height } = imageSize;
          const meterByPx = baseMap.getMeterByPx();

          // Resolve memo lookup (see _resolvedRowsCache at module level):
          // identity of the annotation row + its point rows + base map
          // scalars. Hit → reuse the resolved output, returned as a shallow
          // copy so later in-place field assignments (proxies, profile
          // helpers, entity attach) never poison the cached object.
          const _depRefs = _collectPointRowRefs(annotation, pointsIndex);
          const _variantKey = withQties ? 1 : 0;
          const _memoEntry = _resolvedRowsCache.get(annotation);
          const _memoValid = Boolean(
            _memoEntry &&
            _memoEntry.width === width &&
            _memoEntry.height === height &&
            _memoEntry.meterByPx === meterByPx &&
            _memoEntry.baseMapName === baseMap?.name &&
            _memoEntry.deps.length === _depRefs.length &&
            _memoEntry.deps.every((r, i) => r === _depRefs[i])
          );
          if (_memoValid) {
            const _hit = _memoEntry.variants[_variantKey];
            if (_hit) {
              _resolveMemoHits += 1;
              if (_hit.corruptedPointIds?.length) _missingPointsAnnCount += 1;
              return { ..._hit };
            }
          }

          //if (annotation.isBaseMapAnnotation) console.log("debug_width", width?.toFixed(2))

          _annotation.baseMapName = baseMap?.name;

          // legacy conversion

          const isMarkerLegacy =
            testObjectHasProp(annotation, "x") ||
            testObjectHasProp(annotation, "y");
          if (isMarkerLegacy) {
            annotationPoints = [{ x: annotation.x, y: annotation.y }];
          }

          // markers, labels, ....

          if (_annotation.type === "MARKER") {
            _annotation.point = resolvePoints({
              points: [annotation.point],
              pointsIndex,
              imageSize,
            })[0];
            // single point — can't be dropped, but flag it if unresolved.
            if (!_isResolved(_annotation.point) && _annotation.point?.id)
              corruptedIds.push(_annotation.point.id);
          }

          // --- POINT (and DETAIL / the revolution axis / its elevation
          // placement, all single-point annotations whose extra geometry is
          // carried by scalars — arrowAngle for DETAIL)
          else if (
            _annotation.type === "POINT" ||
            _annotation.type === "DETAIL" ||
            isRevolutionHelperType(_annotation.type)
          ) {
            // A row without a point ref must not reach resolvePoints: throwing
            // here aborts the hook mid-way and shows up as a hook-order crash
            // in the CALLER, not as an error here (see the try/catch wrapper).
            if (annotation.point?.id) {
              _annotation.point = resolvePoints({
                points: [annotation.point],
                pointsIndex,
                imageSize,
              })[0];
              if (!_isResolved(_annotation.point) && _annotation.point?.id)
                corruptedIds.push(_annotation.point.id);
            }
          }

          // --- LABELS / FREE_TEXT (same inline normalized 2-point storage)
          else if (
            _annotation.type === "LABEL" ||
            _annotation.type === "FREE_TEXT"
          ) {
            _annotation.targetPoint = {
              x: annotation.targetPoint.x * width,
              y: annotation.targetPoint.y * height,
            };
            _annotation.labelPoint = {
              x: annotation.labelPoint.x * width,
              y: annotation.labelPoint.y * height,
            };
            // FREE_TEXT sizes are PDF points "as if the base map filled an
            // A4/A3 page": the renderers need the image long side to derive
            // the pt→image-px scale (getFreeTextPageScale), and imageSize is
            // only known here.
            if (_annotation.type === "FREE_TEXT") {
              _annotation.imageLongSidePx = Math.max(width, height);
            }
          }

          // --- IMAGE
          else if (
            annotation.type === "IMAGE" ||
            annotation.type === "RECTANGLE" ||
            annotation.type === "OBJECT_3D"
          ) {
            _annotation.bbox = {
              x: (annotation.bbox?.x ?? 0.25) * width,
              y: (annotation.bbox?.y ?? 0.25) * height,
              width: (annotation.bbox?.width ?? 0.5) * width,
              height: (annotation.bbox?.height ?? 0.5) * height,
            };
          }

          // --- OTHER CASES
          else {
            _annotation.points = _splitResolved(
              resolvePoints({
                points: annotationPoints,
                pointsIndex,
                imageSize,
              }),
              corruptedIds
            );
            // Per-segment flags (hidden / iso / ext / int): the persisted
            // source of truth is start-point-ID arrays; legacy index arrays
            // are converted in memory here (against the RAW refs array they
            // were written for), then the EFFECTIVE indices are recomputed on
            // the resolved ring so index-based readers stay valid even after
            // orphaned refs were dropped. Persisted on next write only
            // (migrate-on-write) — see segmentFlags.js.
            if (hasAnySegmentFlagField(annotation)) {
              const _ringClosed = getAnnotationRingClosed(annotation);
              for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
                const ids = getRingSegmentFlagPointIds(
                  annotation,
                  idxField,
                  idField,
                  annotation.points,
                  { closed: _ringClosed }
                );
                if (ids == null) continue;
                _annotation[idField] = ids;
                _annotation[idxField] = segmentPointIdsToIdx(
                  ids,
                  _annotation.points,
                  { closed: _ringClosed }
                );
              }
            }
            if (_annotation.cuts)
              _annotation.cuts = resolveCuts({
                cuts: annotation.cuts,
                pointsIndex,
                imageSize,
              })
                // resolveCuts maps 1:1, so cutIdx addresses the raw cut (the
                // degenerate filter below must stay AFTER this step).
                ?.map((cut, cutIdx) => {
                  const _cut = {
                    ...cut,
                    points: _splitResolved(cut?.points, corruptedIds),
                  };
                  const rawCut = annotation.cuts[cutIdx];
                  if (hasAnySegmentFlagField(rawCut)) {
                    for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
                      const ids = getRingSegmentFlagPointIds(
                        rawCut,
                        idxField,
                        idField,
                        rawCut?.points,
                        { closed: true }
                      );
                      if (ids == null) continue;
                      _cut[idField] = ids;
                      _cut[idxField] = segmentPointIdsToIdx(ids, _cut.points, {
                        closed: true,
                      });
                    }
                  }
                  return _cut;
                })
                // a hole with < 3 points is degenerate (breaks triangulation)
                .filter((cut) => (cut?.points?.length ?? 0) >= 3);
            // Inner Steiner points (POLYGON only) — resolve to pixel space so
            // the rendering and 3D pipelines see them in the same units as the
            // contour and cuts.
            if (annotation.innerPoints) {
              _annotation.innerPoints = _splitResolved(
                resolvePoints({
                  points: annotation.innerPoints,
                  pointsIndex,
                  imageSize,
                }),
                corruptedIds
              );
            }
            if (Array.isArray(annotation.guideLines)) {
              _annotation.guideLines = annotation.guideLines.map((g) => ({
                ...g,
                points: _splitResolved(
                  resolveGuideLine({
                    guideLine: g?.points,
                    pointsIndex,
                    imageSize,
                  }),
                  corruptedIds
                ),
              }));
            }
            // isoHeightLines (constant-height contour lines) share the
            // guideLine ref shape ({pointId, type}) — resolve them the same
            // way. `height` (meters, offsetTop semantics) passes through.
            if (Array.isArray(annotation.isoHeightLines)) {
              _annotation.isoHeightLines = annotation.isoHeightLines.map(
                (l) => ({
                  ...l,
                  points: _splitResolved(
                    resolveGuideLine({
                      guideLine: l?.points,
                      pointsIndex,
                      imageSize,
                    }),
                    corruptedIds
                  ),
                })
              );
            }
            // profileLines (shell cross-sections) share the guideLine ref
            // shape plus an inline per-vertex `height` — dedicated resolver
            // so heights pass through.
            if (Array.isArray(annotation.profileLines)) {
              _annotation.profileLines = annotation.profileLines.map((l) => ({
                ...l,
                points: _splitResolved(
                  resolveProfileLine({
                    profileLine: l?.points,
                    pointsIndex,
                    imageSize,
                  }),
                  corruptedIds
                ),
              }));
            }
            // profileLines and isoHeightLines COEXIST: both constrain the
            // same surface (the shell build merges them as constraint lines).
            // Only the guideLine ramp is exclusive with them.
            const hasProfileLines = _annotation.profileLines?.some(
              (l) => l?.points?.length >= 2
            );
            const hasIsoHeightLines = _annotation.isoHeightLines?.some(
              (l) => l?.points?.length >= 2
            );

            // guideLines ramp: derive each vertex's offsetTop from its
            // projection onto the nearest guideLine (height accumulates
            // along the ordered lines) so the sloped surface is a pure
            // function of position (iso-lines normal to the guideLines)
            // and stays correct when the contour is edited.
            // Stairs guideLines (isStairs) opt out: the stepped surface is
            // built by the dedicated 3D stairs builder and the stairs qties
            // path, not by per-vertex ramp offsets.
            // isoHeightLines / profileLines take precedence: when present
            // they drive the surface heights, so the guideLine ramp bake is
            // skipped.
            if (
              !hasProfileLines &&
              !hasIsoHeightLines &&
              !_annotation.guideLines?.some(
                (g) => g?.isStairs && g?.points?.length >= 2
              ) &&
              _annotation.guideLines?.some(
                (g) => g?.points?.length >= 2 && g?.slopePct
              )
            ) {
              const ramped = applyGuideLineRampToRings({
                points: _annotation.points,
                cuts: _annotation.cuts,
                innerPoints: _annotation.innerPoints,
                guideLines: _annotation.guideLines,
                meterByPx,
              });
              _annotation.points = ramped.points;
              _annotation.cuts = ramped.cuts;
              _annotation.innerPoints = ramped.innerPoints;
            }

            // isoHeightLines: pin the offsetTop of every ring vertex lying ON
            // an iso line to that line's height. Other vertices keep their own
            // stored offsetTop — dragging an iso line must not move them (the
            // sloped faces between constraints are built by the 3D partition).
            if (hasIsoHeightLines) {
              const isoed = applyIsoHeightLinesToRings({
                points: _annotation.points,
                cuts: _annotation.cuts,
                innerPoints: _annotation.innerPoints,
                isoHeightLines: _annotation.isoHeightLines,
              });
              _annotation.points = isoed.points;
              _annotation.cuts = isoed.cuts;
              _annotation.innerPoints = isoed.innerPoints;
            }

            // profileLines never pin ring vertices — continuity goes the
            // other way: profile ENDPOINTS inherit the contour's interpolated
            // offsetTop (baked here, AFTER the iso pinning so an endpoint
            // landing on an iso-pinned vertex inherits the pinned height).
            // Single source of truth for 2D / elevation / 3D.
            // POLYGON shells only — POLYLINE extrusion profiles are FREE
            // cross-sections (all vertices keep their own inline height).
            if (hasProfileLines && annotation.type === "POLYGON") {
              _annotation.profileLines = applyProfileEndpointContinuity({
                profileLines: _annotation.profileLines,
                points: _annotation.points,
                cuts: _annotation.cuts,
              });
            }
          }

          // --- MISSING POINTS (orphaned refs, dropped above) ---
          if (corruptedIds.length) {
            _annotation.corruptedPointIds = corruptedIds;
            _missingPointsAnnCount += 1;
          }

          // --- ROTATION CENTER (resolve to pixels) ---

          if (_annotation.rotationCenter) {
            _annotation.rotationCenter = {
              x: _annotation.rotationCenter.x * width,
              y: _annotation.rotationCenter.y * height,
            };
          }

          // --- QTIES ---

          if (withQties) {
            _annotation.qties = getAnnotationQties({
              annotation: _annotation,
              meterByPx,
            });
          }

          // Store the pristine resolved object in the memo and return a
          // shallow copy (same contract as the memo-hit path above).
          const _entry = _memoValid
            ? _memoEntry
            : {
                deps: _depRefs,
                width,
                height,
                meterByPx,
                baseMapName: baseMap?.name,
                variants: {},
              };
          _entry.variants[_variantKey] = _annotation;
          _resolvedRowsCache.set(annotation, _entry);
          return { ..._annotation };
        });

      // Warn once (per change) about annotations with orphaned point refs.
      if (_missingPointsAnnCount !== _lastMissingPointsWarnCount) {
        _lastMissingPointsWarnCount = _missingPointsAnnCount;
        if (_missingPointsAnnCount > 0) {
          console.warn(
            `[useAnnotationsV2] missing points for ${_missingPointsAnnCount} annotation(s) — some point refs have no matching db.points record (orphaned); they are dropped from the resolved geometry and listed in annotation.corruptedPointIds.`
          );
        }
      }

      // -- LISTING NAME + TAG isForBaseMaps (single pass) --

      _annotations = _annotations.map((a) => ({
        ...a,
        ...(withListingName && {
          listingName: listingsMap[a?.listingId]?.name || "-?-",
        }),
        isForBaseMaps: forBaseMapsListingIds.has(a.listingId),
      }));

      // -- SORT --
      // outdated : use fractional indexing insteaad.

      //const annotationById = getItemsByKey(_annotations, "id");

      // const sortedAnnotationIds = [];
      // listings.forEach((listing) => {
      //     if (listing.sortedAnnotationIds) {
      //         sortedAnnotationIds.push(...listing.sortedAnnotationIds);
      //     } else {
      //         sortedAnnotationIds.push(
      //             ..._annotations
      //                 .filter((a) => a.listingId === listing.id || a.isBaseMapAnnotation)
      //                 .map((a) => a.id)
      //         );
      //     }
      // });

      // _annotations = sortedAnnotationIds.map((id) => annotationById[id]);

      const _t5 = performance.now();
      // -- ENTITY (batched) --

      if (withEntity) {
        // Group annotations by table for batch fetching
        const _te0 = performance.now();
        const byTable = {};
        for (const annotation of _annotations) {
          let table = annotation?.listingTable;
          if (!table) table = listingsMap?.[annotation?.listingId]?.table;
          if (table && annotation.entityId) {
            if (!byTable[table]) byTable[table] = new Set();
            byTable[table].add(annotation.entityId);
          }
        }

        // Incremental batch fetch: only fetch IDs not already in cache
        const entityCache = {};
        let _fetchedCount = 0;
        for (const [table, ids] of Object.entries(byTable)) {
          // Ensure hooks are registered for this table
          if (!_hookedEntityTables.has(table)) {
            _hookEntityTable(table);
            _hookedEntityTables.add(table);
          }
          // Init table cache if needed
          if (!_entitiesCache[table]) {
            _entitiesCache[table] = { cache: new Map() };
          }
          const tableCache = _entitiesCache[table].cache;

          // Find IDs not in cache
          const missingIds = [];
          for (const id of ids) {
            if (tableCache.has(id)) {
              entityCache[id] = tableCache.get(id);
            } else {
              missingIds.push(id);
            }
          }

          // Fetch only missing IDs
          if (missingIds.length > 0) {
            const fetched = await db[table]
              .where("id")
              .anyOf(missingIds)
              .toArray();
            _fetchedCount += fetched.length;
            for (const e of fetched) {
              tableCache.set(e.id, e);
              entityCache[e.id] = e;
            }
          }
        }
        const _te1 = performance.now();

        // Batch fetch all files needed by entities
        const entityFileNames = new Set();
        for (const entity of Object.values(entityCache)) {
          if (Array.isArray(entity.images))
            entity.images.forEach((img) => {
              if (img?.fileName) entityFileNames.add(img.fileName);
            });
          for (const [key, val] of Object.entries(entity)) {
            if (
              key !== "images" &&
              val &&
              typeof val === "object" &&
              val.isImage &&
              val.fileName
            )
              entityFileNames.add(val.fileName);
          }
        }
        const entityFilesArray =
          entityFileNames.size > 0
            ? await db.files
                .where("fileName")
                .anyOf([...entityFileNames])
                .toArray()
            : [];
        const entityFilesMap = {};
        for (const f of entityFilesArray) {
          entityFilesMap[f.fileName] = f;
        }
        const _te2 = performance.now();

        if (_te2 - _te0 >= 10) {
          console.log(
            `[debug_perf]   entities detail: db.entities=${(_te1 - _te0).toFixed(1)}ms (${Object.keys(entityCache).length} entities, ${_fetchedCount} fetched) | db.files=${(_te2 - _te1).toFixed(1)}ms (${entityFilesArray.length} files)`
          );
        }

        // Enrich annotations with entities
        _annotations = await Promise.all(
          _annotations.map(async (annotation) => {
            let table = annotation?.listingTable;
            if (!table) table = listingsMap?.[annotation?.listingId]?.table;
            if (table && annotation.entityId) {
              const entity = entityCache[annotation.entityId];
              const { entityWithImages, hasImages } =
                await getEntityWithImagesAsync(entity, entityFilesMap);
              const listing = listingsMap[annotation?.listingId];
              const em =
                appConfig?.entityModelsObject?.[listing.entityModelKey];
              const labelKey = em?.labelKey || "label";
              let label = entity?.[labelKey];
              const pad = em?.labelOptions?.zeroPadStart;
              const prefix = em?.labelOptions?.prefix;
              if (pad && label != null)
                label = label.toString().padStart(pad, "0");
              if (prefix && label != null) label = `${prefix}${label}`;
              return {
                ...annotation,
                entity: entityWithImages,
                hasImages,
                // `label` below is the ENTITY label. Keep the annotation row's
                // own label around: the "Etiquette" feature renders that one,
                // deliberately decoupled from entities (and from appConfig,
                // which resolves the entity labelKey asynchronously).
                annotationLabel: annotation.label,
                label,
              };
            } else {
              return annotation;
            }
          })
        );
      }

      const _t6 = performance.now();
      // Only log the breakdown when the run is actually slow: healthy runs
      // (a few ms, several per commit across the ~8 instances) would flood
      // the console and evict the useful lines.
      if (_t6 - _t0 >= 20) {
        console.log(
          `[debug_perf] useAnnotationsV2 [${_caller}] (${_annotations?.length ?? 0} annotations):\n` +
            `  obs reads:      ${_obsMs().toFixed(1)}ms (overlapped)\n` +
            `  DB fetch:       ${(_t1 - _t0).toFixed(1)}ms (${listingsIds.length} listingIds${_annRowsSharedHit ? ", shared rows hit" : ", shared rows MISS"})\n` +
            `  filters:        ${(_t2 - _t1).toFixed(1)}ms\n` +
            `  listings total: ${(_t3 - _t2).toFixed(1)}ms  [db.listings: ${(_t2b - _t2a).toFixed(1)}ms (${listings.length} found) | filters+scope: ${(_t2c - _t2b).toFixed(1)}ms | db.layers+sort: ${(_t3 - _t2c).toFixed(1)}ms]\n` +
            `  images batch:   ${(_t4 - _t3).toFixed(1)}ms\n` +
            `  points/qties:   ${(_t5 - _t4).toFixed(1)}ms (${referencedPointIds?.size ?? 0} pts, ${_pointsFetchedFromDb} from db, resolve memo ${_resolveMemoHits}/${_annotations?.length ?? 0})\n` +
            `  entities:       ${(_t6 - _t5).toFixed(1)}ms\n` +
            `  TOTAL:          ${(_t6 - _t0).toFixed(1)}ms`
        );
      }

      // -- EXTRUSION_PROFILE SUBTRACTION FOOTPRINTS --
      // For profile annotations used as subtraction targets, precompute
      // their exact planar footprint (the swept prisms' XY projection) so
      // the synchronous surface-quantity path can subtract it precisely.
      // Gated to actual targets to avoid resolving profiles otherwise.
      if (subtractionTargetIdsBySource?.size > 0 && _annotations?.length) {
        const targetIdSet = new Set();
        for (const ids of subtractionTargetIdsBySource.values()) {
          for (const id of ids) targetIdSet.add(id);
        }
        if (targetIdSet.size > 0) {
          const profileResCache = new Map();
          for (const a of _annotations) {
            if (!a || !targetIdSet.has(a.id)) continue;
            if (getShape3DKey(a.shape3D) !== "EXTRUSION_PROFILE") continue;
            const tplId = a.shape3D?.profileTemplateId;
            if (!tplId) continue;
            let res = profileResCache.get(tplId);
            if (res === undefined) {
              res = await resolveProfileFromDb(tplId);
              profileResCache.set(tplId, res);
            }
            const bm = baseMapById[a.baseMapId];
            const shapes = getExtrusionProfileFootprintShapes(
              a,
              bm?.getMeterByPx?.(),
              res
            );
            if (shapes) a._profileFootprintShapes = shapes;
          }
        }
      }

      // -- REVOLUTION (axis-based) resolution --
      // The axis lives on the PLAN; each VERTICAL base map that uses it carries
      // a REVOLUTION_AXIS_PLACEMENT whose point is where the axis centre sits in
      // that elevation image. Placing it also POSED the base map so its plane
      // contains the axis (see computeVerticalBaseMapPlacementFromAxis), which
      // is what lets us synthesize the lathe axis purely from the placement:
      //
      //   - revolutionAxisPoints: a vertical 2-point segment through the
      //     placement point, in the ARC's reference-frame PIXELS (what
      //     createAnnotationObject3D feeds to pointsToLocal → buildRevolutionMesh).
      //     Only `mean(x)` is load-bearing — buildRevolutionMesh's `baseY`
      //     cancels out on a VERTICAL base map (center.y = baseY, height =
      //     y − baseY), so the world height comes from the solved pose alone.
      //     The 2nd point goes UP in pixels so that after pixelToWorld's y-flip
      //     the metre-space minimum still lands exactly on the placement point.
      //   - revolutionPhi: the partial-revolution sector, resolved ONCE per axis
      //     and shared by every arc bound to it.
      //
      // `revolutionCenterLocal` is deliberately NOT set any more: the base map
      // pose now guarantees the axis lies in the plane (so the builder's
      // z = 0 default is correct), and dropping it removes the cross-base-map
      // pose read that made this query depend on base map transforms.
      if (_annotations?.length) {
        const revolutionArcs = _annotations.filter(
          (a) =>
            a &&
            getShape3DKey(a.shape3D) === "REVOLUTION" &&
            a.shape3D?.axisAnnotationId
        );

        if (revolutionArcs.length > 0) {
          const arcBaseMapIds = [
            ...new Set(revolutionArcs.map((a) => a.baseMapId).filter(Boolean)),
          ];
          const placements = (
            await db.annotations
              .where("baseMapId")
              .anyOf(arcBaseMapIds)
              .toArray()
          ).filter(
            (a) => !a.deletedAt && a.type === "REVOLUTION_AXIS_PLACEMENT"
          );
          // Keyed by (baseMapId, axisId): several scopes may each pose their
          // OWN axis on the same vertical base map, so a lone per-base-map
          // entry could resolve an arc to another scope's placement and wrongly
          // flag it revolutionMissingPlacement (profile rendered un-revolved).
          const placementByBaseMapAndAxisId = {};
          for (const p of placements) {
            placementByBaseMapAndAxisId[
              `${p.baseMapId}:${p.revolutionAxisId}`
            ] = p;
          }

          // Placement points live on ANOTHER base map than the arc, so they are
          // not in `pointsIndex` — fetch them explicitly.
          const placementPointRows = await db.points.bulkGet(
            placements.map((p) => p.point?.id).filter(Boolean)
          );
          const placementPointById = {};
          for (const row of placementPointRows) {
            if (row) placementPointById[row.id] = row;
          }

          const axisCache = new Map();
          for (const arc of revolutionArcs) {
            const axisId = arc.shape3D.axisAnnotationId;
            if (!axisCache.has(axisId)) {
              axisCache.set(axisId, await db.annotations.get(axisId));
            }
            const axis = axisCache.get(axisId);
            if (!axis || axis.deletedAt) {
              arc.revolutionMissingPlacement = true;
              continue;
            }

            // A placement of a DIFFERENT axis is not "close enough" (the key
            // carries the axis id): flag it rather than silently revolving
            // around the wrong centre.
            const placement =
              placementByBaseMapAndAxisId[`${arc.baseMapId}:${axisId}`];
            if (!placement) {
              arc.revolutionMissingPlacement = true;
              continue;
            }

            const arcBaseMap = baseMapById[arc.baseMapId];
            const arcImageSize =
              arcBaseMap?.getImageSize?.() || arcBaseMap?.image?.imageSize;
            const row = placementPointById[placement.point?.id];
            if (!arcImageSize?.width || !row) {
              arc.revolutionMissingPlacement = true;
              continue;
            }

            const cx = row.x * arcImageSize.width;
            const cy = row.y * arcImageSize.height;
            arc.revolutionAxisPoints = [
              { x: cx, y: cy },
              { x: cx, y: cy - AXIS_SYNTH_SPAN_PX },
            ];
            arc.revolutionPhi = getRevolutionPhiForAxis(axis);
          }
        }
      }

      // Plan axes and their placements need a few resolved extras for the 2D
      // renderers, the pure drag math and the snap candidates (none of which
      // get a base map of their own).
      //
      // `_snapPoints` = the anchors a drawing may snap onto: the centre and the
      // two diameter ends. They are DERIVED from the radius/direction scalars
      // (not db.points rows), so they only exist once the scale is known — i.e.
      // here. See getBestSnap.
      if (_annotations?.length) {
        const axisRefCache = new Map();
        for (const a of _annotations) {
          if (a?.type === "REVOLUTION_AXIS") {
            const meterByPx = baseMapById[a.baseMapId]?.getMeterByPx?.();
            a._planMeterByPx = meterByPx;
            const frame =
              a.point &&
              getRevolutionAxisPlanFrame({
                centerPx: a.point,
                radiusM: a.radiusM,
                directionDeg: a.directionDeg,
                invertHalf: a.invertHalf,
                meterByPx,
              });
            if (frame) {
              a._snapPoints = [
                { x: frame.centerPx.x, y: frame.centerPx.y },
                ...frame.rimPx.map((p) => ({ x: p.x, y: p.y })),
              ];
            }
          } else if (a?.type === "REVOLUTION_AXIS_PLACEMENT") {
            const axisId = a.revolutionAxisId;
            if (!axisId) continue;
            if (!axisRefCache.has(axisId)) {
              axisRefCache.set(axisId, await db.annotations.get(axisId));
            }
            const axis = axisRefCache.get(axisId);
            if (!axis || axis.deletedAt) continue;
            // The inverted-T bar is the plan diameter, and the stem is the axis
            // height — both live on the axis, on another base map.
            a.revolutionAxisRadiusM = axis.radiusM;
            a.revolutionAxisHeightM = axis.height;
            a.revolutionAxisLabel = axis.label;

            // Same three anchors seen edge-on: the centre and both ends of the
            // orange bar (the plan diameter laid flat on the elevation). The
            // centre is always published — an axis whose radius cannot be
            // converted to pixels still has a meaningful centre to snap onto.
            const meterByPx = baseMapById[a.baseMapId]?.getMeterByPx?.();
            const r = Number(axis.radiusM);
            if (a.point) {
              const anchors = [{ x: a.point.x, y: a.point.y }];
              if (Number.isFinite(meterByPx) && meterByPx > 0 && r > 0) {
                const halfPx = r / meterByPx;
                anchors.push(
                  { x: a.point.x - halfPx, y: a.point.y },
                  { x: a.point.x + halfPx, y: a.point.y }
                );
              }
              a._snapPoints = anchors;
            }
          }
        }
      }

      // -- OPEN-SURFACE SUBTRACTION SOURCES (developed surface) --
      // For EXTRUSION_PROFILE / REVOLUTION hosts that subtract other
      // annotations, the carved quantity is a developed surface (not a
      // footprint), so run the same headless 3D carve as the display.
      // Profiles additionally resolve the profile length (base surface) and
      // store the REMOVED m² (deducted from the analytic surface in the
      // post-processing pass); revolutions store the CARVED mesh
      // triangle-sum, used directly as the surface. Gated to withQties.
      // Must run AFTER the revolution axis resolution above — the lathe
      // builder needs `revolutionAxisPoints`.
      // -- CROSS-BASE-MAP SUBTRACTION TARGETS --
      // The query is scoped to one base map (plus the 3D extras), so a
      // subtraction target living on ANOTHER base map is absent from
      // `_annotations` and would be silently dropped by the `.filter(Boolean)`
      // that resolves targets. Fetch and resolve those rows here — the same
      // supplementary read the revolution placements do above — and stash them
      // on the source annotation. They are deliberately NOT pushed into
      // `_annotations`: they must never show up in this base map's listings,
      // quantities, selection or exports. Their points are resolved against
      // THEIR OWN base map, so they stay in their own pixel frame; only the 3D
      // world (or an explicit projection) can relate the two.
      let _foreignTargetsById = null;
      if (subtractionTargetIdsBySource?.size > 0 && _annotations?.length) {
        const presentIds = new Set(_annotations.map((a) => a?.id));
        const missingTargetIds = new Set();
        for (const a of _annotations) {
          const ids = subtractionTargetIdsBySource.get(a?.id);
          if (!ids) continue;
          for (const id of ids)
            if (!presentIds.has(id)) missingTargetIds.add(id);
        }
        if (missingTargetIds.size > 0) {
          const rows = (
            await db.annotations.bulkGet([...missingTargetIds])
          ).filter((r) => r && !r.deletedAt && r.baseMapId);
          const refIds = [];
          for (const r of rows) {
            for (const p of r.points ?? []) if (p?.id) refIds.push(p.id);
            if (r.point?.id) refIds.push(r.point.id);
          }
          const ptRows = refIds.length ? await db.points.bulkGet(refIds) : [];
          const ptIndex = {};
          for (const p of ptRows) if (p?.id && !p.deletedAt) ptIndex[p.id] = p;

          _foreignTargetsById = new Map();
          for (const r of rows) {
            const bm = baseMapById[r.baseMapId];
            const imageSize = bm?.getImageSize?.() || bm?.image?.imageSize;
            if (!imageSize) continue;
            _foreignTargetsById.set(r.id, {
              ...r,
              points: r.points
                ? resolvePoints({
                    points: r.points,
                    pointsIndex: ptIndex,
                    imageSize,
                  })
                : r.points,
              point: r.point
                ? resolvePoints({
                    points: [r.point],
                    pointsIndex: ptIndex,
                    imageSize,
                  })?.[0]
                : r.point,
            });
          }
        }
      }

      // A target is "foreign" when it sits on ANOTHER base map than its host —
      // whether it came from the query or from the supplementary fetch above.
      // Deriving this from the base map ids (and not from "was it missing from
      // the scope?") is what makes it independent of the caller's options: a
      // project-wide instance has every target in scope, yet the footprints
      // must still exist there or the toolbar cannot resolve a selected one.
      if (subtractionTargetIdsBySource?.size > 0 && _annotations?.length) {
        const byId = new Map(_annotations.map((a) => [a?.id, a]));
        for (const a of _annotations) {
          const ids = subtractionTargetIdsBySource.get(a?.id);
          if (!ids?.length) continue;
          const foreign = ids
            .map((id) => byId.get(id) ?? _foreignTargetsById?.get(id))
            .filter((t) => t?.baseMapId && t.baseMapId !== a?.baseMapId);
          if (foreign.length > 0) a._foreignSubtractionTargets = foreign;
        }
      }

      // -- 2D FOOTPRINT OF FOREIGN TARGETS --
      // Read-only outline drawn on THIS base map for each subtraction target
      // hosted by another one. It is the silhouette of the target's real 3D
      // SOLID projected onto this plane — not its flat contour, which would
      // ignore the height/thickness the solid actually spans and would not
      // match the hole seen in 3D.
      if (_annotations?.length) {
        const hosts = _annotations.filter(
          (a) => a?._foreignSubtractionTargets?.length
        );
        for (const a of hosts) {
          const hostBaseMap = baseMapById[a.baseMapId];
          const hostForRender = getBaseMapForRender(hostBaseMap);
          if (!hostForRender?.meterByPx) continue;
          const hostTransform = getBaseMapTransform(hostBaseMap);
          const footprints = [];
          for (const target of a._foreignSubtractionTargets) {
            const tbm = baseMapById[target.baseMapId];
            if (!tbm) continue;
            const rings = await getAnnotationFootprintOnBaseMap({
              annotation: target,
              forRender: getBaseMapForRender(tbm),
              transform: getBaseMapTransform(tbm),
              hostForRender,
              hostTransform,
            });
            if (rings?.length) footprints.push({ targetId: target.id, rings });
          }
          if (footprints.length > 0)
            a._foreignSubtractionFootprints = footprints;
        }
      }

      if (
        withQties &&
        subtractionTargetIdsBySource?.size > 0 &&
        _annotations?.length
      ) {
        const profileLenCache = new Map();
        for (const a of _annotations) {
          const targetIds = subtractionTargetIdsBySource.get(a?.id);
          if (!targetIds || targetIds.length === 0) continue;
          const shapeKey = getShape3DKey(a.shape3D);
          const targets = targetIds
            .map(
              (id) =>
                _annotations.find((x) => x?.id === id) ??
                _foreignTargetsById?.get(id)
            )
            .filter(Boolean);
          if (targets.length === 0) continue;
          // A target on another base map makes the planar (pixel) path
          // meaningless — the two pixel frames are unrelated — so the mesh
          // area becomes the only valid quantity, whatever the source shape.
          const isCrossBaseMap = targets.some(
            (t) => t?.baseMapId && t.baseMapId !== a.baseMapId
          );
          if (
            !isCrossBaseMap &&
            !["EXTRUSION_PROFILE", "REVOLUTION"].includes(shapeKey)
          )
            continue;
          const bm = baseMapById[a.baseMapId];
          const imageSize = bm?.getImageSize?.() || bm?.image?.imageSize;
          const meterByPx = bm?.getMeterByPx?.();
          if (!imageSize?.width || !meterByPx) continue;
          const baseMapForRender = {
            imageWidth: imageSize.width,
            imageHeight: imageSize.height,
            meterByPx,
            // Needed by REVOLUTION: the lathe axis follows the base map
            // normal (HORIZONTAL) or local +Y (VERTICAL) — must match the
            // scene build so the headless carve cuts the same hole.
            orientation: bm?.orientation,
          };
          const tplId =
            shapeKey === "EXTRUSION_PROFILE"
              ? a.shape3D?.profileTemplateId
              : null;
          if (tplId) {
            let plm = profileLenCache.get(tplId);
            if (plm === undefined) {
              const res = await resolveProfileFromDb(tplId);
              plm = res?.profileLengthMeters ?? null;
              profileLenCache.set(tplId, plm);
            }
            if (plm != null) a._profileLengthMeters = plm;
          }
          try {
            const res = await computeSubtractedSurfaceM2Async(
              a,
              baseMapForRender,
              targets,
              // Only needed cross-base-map: lets the util pose each operand
              // with its own base map's world placement.
              isCrossBaseMap
                ? { sourceBaseMapId: a.baseMapId, baseMapsById: baseMapById }
                : undefined
            );
            if (res) {
              if (shapeKey === "EXTRUSION_PROFILE") {
                a._subtractedSurfaceM2 = res.removedM2;
              } else {
                a._carvedSurfaceM2 = res.carvedM2;
              }
              // Flag consumed below so the planar path leaves qties.surface
              // alone: a footprint across two unrelated pixel frames is
              // meaningless, the developed mesh area is what holds.
              if (isCrossBaseMap) {
                a._hasCrossBaseMapSubtraction = true;
                a._crossBaseMapCarvedSurfaceM2 = res.carvedM2;
                a._crossBaseMapRemovedSurfaceM2 = res.removedM2;
              }
            }
          } catch (e) {
            console.error(
              "[useAnnotationsV2] profile subtraction qty failed",
              e
            );
          }
        }
      }

      // -- PHOTO PLANS (perspective calibration) --
      // Annotations drawn on a PHOTO baseMap are auto-attached to one of its
      // photoPlans (centroid inside the plan's source polygon). When the
      // plan is calibrated, the pixel points are mapped through the
      // homography into the plane's metric frame:
      //   - _photoPlanQties: real quantities computed on the meter points
      //     (meterByPx = 1 — stage B short-circuits like isProxy),
      //   - _photoPlan3D: pose + plane-local geometry (image-like y-down
      //     meters, the exact input of createPhotoPlanObject3D).
      // Reading db.photoPlans here makes the liveQuery re-emit on
      // recalibration. Zero cost when no photo baseMap is displayed.
      if (_annotations?.length) {
        const photoAnns = _annotations.filter(
          (a) =>
            a &&
            !a.isForBaseMaps &&
            !a.isBaseMapAnnotation &&
            baseMapById[a.baseMapId]?.isPhoto
        );
        if (photoAnns.length > 0) {
          const photoIds = [...new Set(photoAnns.map((a) => a.baseMapId))];
          const plans = (
            await db.photoPlans.where("baseMapId").anyOf(photoIds).toArray()
          ).filter((p) => !p.deletedAt);
          // A plan's own source polygon must never be RECONSTRUCTED in 3D —
          // its 3D representation is the textured plane (PhotoPlansManager).
          // It still gets attached + real quantities (= the plan's surface).
          const planSourceAnnotationIds = new Set(
            plans.map((p) => p.annotationId)
          );

          // Resolve each plan's source polygon once per run (direct db read:
          // the source lives in an isForBaseMaps listing, invisible here).
          const plansByBaseMap = {};
          for (const plan of plans) {
            // Whole-photo plan (no source polygon): zone = full image.
            if (!plan.annotationId) {
              const bm0 = baseMapById[plan.baseMapId];
              const size0 = bm0?.getImageSize?.() || bm0?.image?.imageSize;
              if (!size0?.width || !size0?.height) continue;
              (plansByBaseMap[plan.baseMapId] ??= []).push({
                plan,
                ringPx: [
                  { x: 0, y: 0 },
                  { x: size0.width, y: 0 },
                  { x: size0.width, y: size0.height },
                  { x: 0, y: size0.height },
                ],
                holesPx: [],
              });
              continue;
            }
            const srcAnn = await db.annotations.get(plan.annotationId);
            if (!srcAnn || srcAnn.deletedAt) continue;
            const bm = baseMapById[plan.baseMapId];
            const imageSize = bm?.getImageSize?.() || bm?.image?.imageSize;
            if (!imageSize?.width || !imageSize?.height) continue;
            const ids = new Set();
            (srcAnn.points ?? []).forEach((p) => p?.id && ids.add(p.id));
            (srcAnn.cuts ?? []).forEach((c) =>
              (c?.points ?? []).forEach((p) => p?.id && ids.add(p.id))
            );
            const arr = await db.points.bulkGet([...ids]);
            const idx = {};
            for (const p of arr) if (p) idx[p.id] = p;
            const ringPx = resolvePoints({
              points: srcAnn.points,
              pointsIndex: idx,
              imageSize,
            });
            if (!ringPx || ringPx.length < 3) continue;
            const holesPx = (srcAnn.cuts ?? [])
              .map((c) =>
                resolvePoints({
                  points: c.points ?? [],
                  pointsIndex: idx,
                  imageSize,
                })
              )
              .filter((h) => h?.length >= 3);
            (plansByBaseMap[plan.baseMapId] ??= []).push({
              plan,
              ringPx,
              holesPx,
            });
          }

          for (const a of photoAnns) {
            const candidates = plansByBaseMap[a.baseMapId];
            if (!candidates?.length || !a.points?.length) continue;
            const att = getPhotoPlanAttachment({
              points: a.points,
              candidates,
            });
            if (!att) continue;
            const { plan } = att;
            a._photoPlanId = plan.id;
            a._photoPlanName = plan.name;
            a._photoPlanOrientation = plan.orientation;

            const calib = plan.calibration;
            // Quick-flatten calibrations are display-only (arbitrary
            // scale/pose) — never feed quantities or 3D from them.
            if (!calib?.ok || calib.isUnscaled || !calib.H || !calib.pose)
              continue;
            const bm = baseMapById[a.baseMapId];
            const imageSize = bm?.getImageSize?.() || bm?.image?.imageSize;
            const isClosed = ["POLYGON", "RECTANGLE"].includes(a.type);

            const ptsM = mapPhotoPointsToPlane({
              H: calib.H,
              points: a.points,
              imageSize,
              closeLine: isClosed,
            });
            if (!ptsM) continue; // beyond the horizon — stay uncalibrated
            const cutsM = [];
            let cutFailed = false;
            for (const cut of a.cuts ?? []) {
              const cutPts = mapPhotoPointsToPlane({
                H: calib.H,
                points: cut?.points ?? [],
                imageSize,
                closeLine: true,
              });
              if (!cutPts) {
                cutFailed = true;
                break;
              }
              cutsM.push({ ...cut, points: cutPts });
            }
            if (cutFailed) continue;

            // Real quantities on the meter geometry (meters-as-pixels).
            a._photoPlanQties = getAnnotationQties({
              annotation: { ...a, points: ptsM, cuts: cutsM },
              meterByPx: 1,
            });

            // No 3D reconstruction for a plan's own source polygon: the
            // textured plane already IS its 3D representation.
            if (planSourceAnnotationIds.has(a.id)) continue;

            // Plane-local geometry for the 3D reconstruction — image-like
            // y-down meters, so createPhotoPlanObject3D's fakeBaseMap
            // (imageWidth/Height 0, meterByPx 1) converts back to the
            // y-up (u, v) frame via pixelToWorld.
            const toLocal = (p) => ({
              x: p.x,
              y: -p.y,
              ...(p.id != null && { id: p.id }),
            });
            a._photoPlan3D = {
              pose: calib.pose,
              orientation: plan.orientation,
              pointsLocal: ptsM.map(toLocal),
              cutsLocal: cutsM.map((cut) => ({
                points: cut.points.map(toLocal),
              })),
            };
          }
        }
      }

      // Observation reads were fired at the top of the callback — settle
      // them before returning so tracking is guaranteed registered and a
      // real read failure still surfaces.
      await _obsPromise;

      // -- READ-ONLY FOOTPRINT ANNOTATIONS --
      // Appended LAST, after every filter and resolve: they are synthesized,
      // not queried, and must not be reshaped by the pipeline. The id is
      // prefixed so no accidental write can ever reach the real row — a drag
      // or a delete on a footprint targets an id that exists in no table
      // (same guard idea as the "label::" selection prefix).
      if (withForeignFootprints) {
        const footprintAnnotations = [];
        for (const a of _annotations) {
          if (!a?._foreignSubtractionFootprints?.length) continue;
          const targetsById = new Map(
            (a._foreignSubtractionTargets ?? []).map((t) => [t.id, t])
          );
          for (const { targetId, rings } of a._foreignSubtractionFootprints) {
            const target = targetsById.get(targetId);
            if (!target || !rings?.length) continue;
            // Outer ring only: the silhouette of a solid seen flat.
            const ring = rings[0];
            footprintAnnotations.push({
              // Style fields (colour, template) come from the original, which
              // is what makes the footprint read as "that annotation".
              ...target,
              id: FOREIGN_FOOTPRINT_ID_PREFIX + targetId,
              type: "POLYGON",
              baseMapId: a.baseMapId,
              points: ring.map(([x, y]) => ({ x, y })),
              point: null,
              isForeignFootprint: true,
              foreignAnnotationId: targetId,
              foreignBaseMapId: target.baseMapId,
              foreignHostAnnotationId: a.id,
              // Never draw a footprint as a 3D solid, and never let it carry
              // quantities: it is a projection of something counted elsewhere.
              shape3D: null,
              height: 0,
              subtractionTargetIds: undefined,
              subtractionTargets: undefined,
              _foreignSubtractionTargets: undefined,
              _foreignSubtractionFootprints: undefined,
            });
          }
        }
        if (footprintAnnotations.length > 0) {
          _annotations = [..._annotations, ...footprintAnnotations];
        }
      }

      // -- PHOTO PSEUDO-ANNOTATIONS --
      // Opt-in (`withPhotos` — Photos module, Viewer module 2D). Appended
      // LAST like the
      // footprints above: photos live in db.photos, not db.annotations, and
      // must not be reshaped by the pipeline. The "photo::" id prefix
      // guarantees no annotation write path can ever reach a real row. The
      // db.photos read is inside the liveQuery on purpose — localization
      // commits re-render for free.
      if (withPhotos && baseMap?.id) {
        const imageSize =
          baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
        if (imageSize?.width) {
          const photoRows = await db.photos
            .where("baseMapId")
            .equals(baseMap.id)
            .toArray();
          const photoAnnotations = photoRows
            .filter((p) => !p.deletedAt && p.point)
            .map((p) => ({
              id: PHOTO_ID_PREFIX + p.id,
              type: "PHOTO",
              isPhoto: true,
              photoId: p.id,
              baseMapId: p.baseMapId,
              listingId: p.listingId,
              point: {
                x: p.point.x * imageSize.width,
                y: p.point.y * imageSize.height,
              },
              directionDeg: p.directionDeg,
              fovDeg: p.fovDeg,
              radiusM: p.radiusM,
              thumbnail: p.image?.thumbnail ?? null,
              name: p.name,
            }));
          if (photoAnnotations.length > 0) {
            _annotations = [..._annotations, ...photoAnnotations];
          }
        }
      }

      return _annotations;
    }, [
      enabled,
      scope?.id,
      baseMap?.id,
      projectId,
      listingId,
      baseMapId,
      extraBaseMapIdsKey,
      excludeListingsIds?.join("-"),
      excludeIsForBaseMapsListings,
      onlyIsForBaseMapsListings,
      baseMapAnnotationsOnly,
      hideBaseMapAnnotations,
      baseMapsUpdatedAt,
      baseMaps?.length,
      withEntity,
      hiddenLayerIds,
      showAnnotationsWithoutLayer,
      layersUpdatedAt,
      subtractionTargetIdsBySource,
      povFreezeCreatedBefore,
      dbWriteTick,
      withForeignFootprints,
      withPhotos,
    ]);

    // memoize post-processing to avoid recomputing on unrelated re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const processed = useMemo(() => {
      // skip post-processing when disabled
      if (!enabled || !annotations || annotations.length === 0) return [];

      // override with annotation templates
      let result = annotations.map((annotation) => {
        if (annotation?.isBaseMapAnnotation) {
          return annotation;
        } else {
          const baseMap = baseMapById[annotation?.baseMapId];
          const templateProps = getAnnotationTemplateProps(
            annotationTemplatesMap[annotation?.annotationTemplateId]
          );
          return getAnnotationPropsFromAnnotationTemplateProps(
            annotation,
            templateProps,
            baseMap
          );
        }
      });

      // Main annotations of located business objects: the object's label
      // wins over the row's own label AND the entity label. Applied after the
      // template override so it can never be shadowed; `annotationLabel` is
      // what the "Etiquette" chip reads, `label` what lists / exports read.
      if (mainBusinessObjectLabelByAnnotationId.size > 0) {
        result = result.map((annotation) => {
          if (annotation?.isBaseMapAnnotation) return annotation;
          const main = mainBusinessObjectLabelByAnnotationId.get(annotation?.id);
          if (!main) return annotation;
          return {
            ...annotation,
            label: main.label,
            annotationLabel: main.label,
            mainBusinessObjectId: main.businessObjectId,
          };
        });
      }

      // recompute qties after template overrides so overridden height is reflected
      if (withQties) {
        // NOTE: no in-place `annotation.qties = ...` here — the identity
        // stabilization cache below compares this run's output against the
        // previous run's cached objects, so stage-B must never mutate
        // objects it may have returned before.
        result = result.map((annotation) => {
          if (annotation?.isBaseMapAnnotation) return annotation;
          // Photo annotations attached to a calibrated photoPlan: real
          // quantities come from the homography-mapped meter geometry
          // (precomputed in the async query) — the photo has no meterByPx.
          if (annotation?._photoPlanQties) {
            return { ...annotation, qties: annotation._photoPlanQties };
          }
          const baseMap = baseMapById[annotation?.baseMapId];
          const meterByPx = baseMap?.getMeterByPx?.();
          if (meterByPx) {
            return {
              ...annotation,
              qties: getAnnotationQties({
                annotation,
                meterByPx,
                // resolved in the async query for EXTRUSION_PROFILE
                // subtraction hosts so the base surface is non-zero.
                profileLengthMeters: annotation._profileLengthMeters,
              }),
            };
          }
          return annotation;
        });
      }

      // -- SUBTRACTIONS --
      // Attach subtraction relations (targetIds + resolved target
      // annotations) so the 3D pipeline can carve the source mesh and the
      // surface quantity reflects the boolean difference.
      if (subtractionTargetIdsBySource?.size > 0) {
        const resultById = getItemsByKey(result, "id");
        result = result.map((a) => {
          const targetIds = subtractionTargetIdsBySource.get(a?.id);
          if (!targetIds || targetIds.length === 0) return a;
          // Targets on another base map are not in `result` (out of scope);
          // they were fetched + resolved in the liveQuery and stashed here.
          const foreignById = new Map(
            (a?._foreignSubtractionTargets ?? []).map((t) => [t.id, t])
          );
          const subtractionTargets = targetIds
            .map((id) => resultById[id] ?? foreignById.get(id))
            .filter(Boolean)
            // Carry each target's OWN base map metrics + pose. The 3D manager
            // can only look those up for base maps loaded in the scene
            // (imagesManager.baseMapsMap), and a cross-base-map target very
            // often lives on a map that is NOT displayed in 3D — it would then
            // silently fall back to the source's frame and land nowhere.
            // Copies, never mutations: these objects are also in `result`, and
            // the identity-stabilization cache must not see them change.
            .map((t) => {
              if (!t?.baseMapId || t.baseMapId === a?.baseMapId) return t;
              const tbm = baseMapById[t.baseMapId];
              if (!tbm) return t;
              return {
                ...t,
                _baseMapForRender: getBaseMapForRender(tbm),
                _baseMapTransform: getBaseMapTransform(tbm),
              };
            });
          const withSub = {
            ...a,
            subtractionTargetIds: targetIds,
            subtractionTargets,
          };
          // Planar-footprint subtraction is only meaningful for
          // slab-type sources (footprint = surface). For POLYLINE
          // surfaces the carved area is a developed/lateral surface,
          // not a footprint, so it is left to a dedicated path.
          const isFootprintSurfaceType = [
            "POLYGON",
            "RECTANGLE",
            "STRIP",
          ].includes(a?.type);
          // A target on another base map is resolved in ITS OWN pixel frame,
          // which has no relation to this one — clipping the two together
          // would carve an arbitrary area. The mesh-area path above already
          // produced the correct developed surface, so leave qties.surface
          // untouched here.
          const hasForeignTarget = subtractionTargets.some(
            (t) => t?.baseMapId && t.baseMapId !== a?.baseMapId
          );
          if (
            withQties &&
            subtractionTargets.length > 0 &&
            isFootprintSurfaceType &&
            !hasForeignTarget
          ) {
            const baseMap = baseMapById[a?.baseMapId];
            const meterByPx = baseMap?.getMeterByPx?.();
            const subQ = getAnnotationSubtractionQties({
              annotation: a,
              targets: subtractionTargets,
              meterByPx,
            });
            if (subQ) withSub.qties = { ...(withSub.qties || {}), ...subQ };
          }

          // Open-surface (EXTRUSION_PROFILE) hosts: subtract the 3D
          // developed surface removed by the boolean (precomputed in
          // the async query as `_subtractedSurfaceM2`).
          if (
            withQties &&
            subtractionTargets.length > 0 &&
            getShape3DKey(a?.shape3D) === "EXTRUSION_PROFILE" &&
            a?._subtractedSurfaceM2 > 0 &&
            withSub.qties
          ) {
            const removed = a._subtractedSurfaceM2;
            const q = { ...withSub.qties };
            if (Number.isFinite(q.surface)) {
              q.surface = Math.max(0, q.surface - removed);
            }
            if (Number.isFinite(q.surfaceDeveloped)) {
              q.surfaceDeveloped = Math.max(0, q.surfaceDeveloped - removed);
            }
            withSub.qties = q;
          }

          // REVOLUTION hosts: the carved surface IS the triangle-sum of the
          // carved lathe mesh (precomputed as `_carvedSurfaceM2`) — replaces
          // the analytic Pappus value so the qty matches the 3D mesh exactly.
          if (
            withQties &&
            subtractionTargets.length > 0 &&
            getShape3DKey(a?.shape3D) === "REVOLUTION" &&
            a?._carvedSurfaceM2 > 0 &&
            withSub.qties
          ) {
            const carved = a._carvedSurfaceM2;
            const q = { ...withSub.qties };
            if (Number.isFinite(q.surface)) q.surface = carved;
            if (Number.isFinite(q.surfaceDeveloped)) {
              q.surfaceDeveloped = carved;
            }
            withSub.qties = q;
          }
          return withSub;
        });
      }

      // -- OPENINGS --
      // Attach glued openings (relAnnotationOpenings) to their host wall and
      // deduct width × overlapHeight from the host's surface quantities.
      // Runs BEFORE the hidden-template filter so openings whose template is
      // hidden still deduct quantities and pierce the 3D meshes — the host
      // keeps the resolved `openings` payload even when the opening
      // annotation itself is dropped from the visible set.
      if (openingRowsByHostId?.size > 0) {
        const resultById = getItemsByKey(result, "id");
        result = result.map((a) => {
          const rels = openingRowsByHostId.get(a?.id);
          if (!rels || rels.length === 0) return a;
          const openings = rels
            .map((rel) => {
              const o = resultById[rel.openingAnnotationId];
              if (!o) return null;
              return {
                id: o.id,
                relId: rel.id,
                width: o.width,
                height: o.height,
                offsetZ: o.offsetZ,
                strokeWidth: o.strokeWidth,
                strokeWidthUnit: o.strokeWidthUnit,
                points: o.points,
                hostDistanceM: rel.hostDistanceM,
              };
            })
            .filter(Boolean);
          if (openings.length === 0) return a;
          const withOpenings = { ...a, openings };
          if (withQties && withOpenings.qties) {
            const openQ = getAnnotationOpeningQties({ host: a, openings });
            if (openQ?.deductedM2 > 0) {
              const q = { ...withOpenings.qties };
              if (Number.isFinite(q.surface)) {
                q.surface = Math.max(0, q.surface - openQ.deductedM2);
              }
              if (Number.isFinite(q.surfaceDeveloped)) {
                q.surfaceDeveloped = Math.max(
                  0,
                  q.surfaceDeveloped - openQ.deductedM2
                );
              }
              withOpenings.qties = q;
            }
          }
          return withOpenings;
        });
      }

      // filter out annotations whose template is hidden
      if (!keepHiddenTemplates) result = result.filter((a) => !a.hidden);

      // exclude profile-template annotations (3D viewer only — they stay
      // visible in 2D, but are dropped from the 3D scene)
      if (excludeProfileTemplates) {
        result = result.filter(
          (a) =>
            a.isBaseMapAnnotation ||
            !annotationTemplatesMap[a.annotationTemplateId]?.isProfile
        );
      }

      // zone solo (zonings module): keep the zone's delimitation polygons
      // (its template) and the annotations linked to the zone via
      // relsZoneAnnotation. Base-map (background) annotations are always kept.
      if (!ignoreSolo && soloZone) {
        const isInZoneSolo = (a) =>
          a.isBaseMapAnnotation ||
          a.annotationTemplateId === soloZone.templateId ||
          zoneSoloAnnotationIdSet.has(a.id);
        if (keepSoloDimmed) {
          result = result.map((a) =>
            isInZoneSolo(a) ? a : { ...a, _soloDimmed: true }
          );
        } else {
          result = result.filter(isInZoneSolo);
        }
      }

      // business-object solo (Ouvrages module): keep only the annotations
      // linked to the selected object or to its descendants
      // (relsBusinessObjectAnnotation). Base-map (background) annotations are
      // always kept, like the zone solo above.
      if (!ignoreSolo && soloBusinessObjectId) {
        const isInBusinessObjectSolo = (a) =>
          a.isBaseMapAnnotation || businessObjectSoloAnnotationIdSet.has(a.id);
        if (keepSoloDimmed) {
          result = result.map((a) =>
            isInBusinessObjectSolo(a) ? a : { ...a, _soloDimmed: true }
          );
        } else {
          result = result.filter(isInBusinessObjectSolo);
        }
      }

      // template focus (Dessin module's recap panel): keep only the focused
      // template's annotations. Base-map (background) annotations are always
      // kept, like the zone solo above.
      if (!ignoreSolo && soloTemplateId) {
        const isInTemplateSolo = (a) =>
          a.isBaseMapAnnotation || a.annotationTemplateId === soloTemplateId;
        if (keepSoloDimmed) {
          result = result.map((a) =>
            isInTemplateSolo(a) ? a : { ...a, _soloDimmed: true }
          );
        } else {
          result = result.filter(isInTemplateSolo);
        }
      }

      // single-annotation focus (panel annotation detail "Isoler"): keep only
      // that annotation. Base-map (background) annotations are always kept.
      if (!ignoreSolo && soloAnnotationId) {
        const isInAnnotationSolo = (a) =>
          a.isBaseMapAnnotation || a.id === soloAnnotationId;
        if (keepSoloDimmed) {
          result = result.map((a) =>
            isInAnnotationSolo(a) ? a : { ...a, _soloDimmed: true }
          );
        } else {
          result = result.filter(isInAnnotationSolo);
        }
      }

      // override with temp annotations
      result = [...result, ...(tempAnnotations ?? [])];

      // bg image text annotations
      if (!baseMapAnnotationsOnly && !excludeBgAnnotations)
        result = [...result, ...(bgImageTextAnnotations ?? [])];

      // sort by listing rank, then template order, with manual orderIndex as top priority
      if (sortByOrderIndex) {
        // listing order map (by rank) — ranks come from the Redux mirror
        // (fresh on any db.listings write); _listingsCache is only a fallback
        // for the first render, before the mirror has loaded.
        const rankedListings = listingsById
          ? Object.values(listingsById)
          : (_listingsCache.listings ?? []);
        const listingOrderMap = new Map();
        if (rankedListings.length) {
          [...rankedListings]
            .sort((a, b) =>
              String(a.rank ?? "").localeCompare(String(b.rank ?? ""))
            )
            .forEach((l, i) => listingOrderMap.set(l.id, i));
        }

        // template order map (by orderIndex + groupLabel consolidation)
        const templateOrderMap = new Map();
        if (annotationTemplatesMap) {
          const templates = Object.values(annotationTemplatesMap);
          const sorted = [...templates].sort((a, b) => {
            const aIdx = a.orderIndex ?? null;
            const bIdx = b.orderIndex ?? null;
            if (aIdx && bIdx) return aIdx < bIdx ? -1 : aIdx > bIdx ? 1 : 0;
            if (aIdx && !bIdx) return -1;
            if (!aIdx && bIdx) return 1;
            return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
          });
          // consolidate groups by groupLabel
          const consolidated = [];
          const consumed = new Set();
          const normalizeGroup = (g) =>
            (g ?? "").trim().toUpperCase().replace(/\s+/g, "");
          for (const t of sorted) {
            if (consumed.has(t.id)) continue;
            consumed.add(t.id);
            consolidated.push(t);
            const ng = normalizeGroup(t.groupLabel);
            if (ng) {
              for (const t2 of sorted) {
                if (
                  !consumed.has(t2.id) &&
                  normalizeGroup(t2.groupLabel) === ng
                ) {
                  consumed.add(t2.id);
                  consolidated.push(t2);
                }
              }
            }
          }
          consolidated.forEach((t, i) => templateOrderMap.set(t.id, i));
        }

        const maxListingOrder = listingOrderMap.size;
        const maxTemplateOrder = templateOrderMap.size;

        result = result.sort((a, b) => {
          // base map annotations always below
          if (a.isBaseMapAnnotation !== b.isBaseMapAnnotation) {
            return a.isBaseMapAnnotation ? -1 : 1;
          }

          const aHasManual = a.orderIndex != null;
          const bHasManual = b.orderIndex != null;

          // manual orderIndex (useMoveAnnotation) = highest priority
          if (aHasManual && bHasManual) {
            return a.orderIndex < b.orderIndex
              ? -1
              : a.orderIndex > b.orderIndex
                ? 1
                : 0;
          }
          if (aHasManual) return 1;
          if (bHasManual) return -1;

          // listing rank order
          const aListing = listingOrderMap.get(a.listingId) ?? maxListingOrder;
          const bListing = listingOrderMap.get(b.listingId) ?? maxListingOrder;
          if (aListing !== bListing) return aListing - bListing;

          // template order within listing
          const aTemplate =
            templateOrderMap.get(a.annotationTemplateId) ?? maxTemplateOrder;
          const bTemplate =
            templateOrderMap.get(b.annotationTemplateId) ?? maxTemplateOrder;
          return aTemplate - bTemplate;
        });
      }

      // group by base map
      if (groupByBaseMap) {
        const baseMapIds = [
          ...new Set(
            result.filter((a) => Boolean(a.baseMapId)).map((a) => a.baseMapId)
          ),
        ];
        const baseMaps = baseMapIds.map((id) => baseMapById[id]);
        result = result.map((a) => ({
          ...a,
          baseMap: baseMapById[a.baseMapId],
        }));
        result = [
          ...result,
          ...baseMaps.map((b) => ({ id: b.id, baseMap: b, isBaseMap: true })),
        ];
        result
          .sort((a, b) => (a.isBaseMap ? 1 : 2) - (b.isBaseMap ? 1 : 2))
          .sort((a, b) => a.baseMap?.name.localeCompare(b.baseMap?.name));
      }

      // Identity stabilization: reuse the previous run's object (and array)
      // references for annotations whose resolved content did not change, so
      // memo(NodeAnnotationStatic) & co only re-render what actually changed.
      const _tStab = performance.now();
      const { list: stableResult, reused } = stabilizeAnnotationsIdentity(
        stabilityRef.current,
        result
      );
      // Only log when something actually changed (or the compare got slow):
      // idle all-reused runs fire on every consumer re-render and their logs
      // flood the console buffer, evicting the interesting commit lines.
      if (reused < result.length || performance.now() - _tStab >= 5) {
        console.log(
          `[debug_perf] useAnnotationsV2 [${_caller}] stability: ${reused}/${result.length} reused (${(performance.now() - _tStab).toFixed(1)}ms)`
        );
      }

      return stableResult;
    }, [
      enabled,
      annotations,
      annotationTemplatesMap,
      baseMapById,
      withQties,
      soloZone,
      zoneSoloAnnotationIdSet,
      soloBusinessObjectId,
      businessObjectSoloAnnotationIdSet,
      mainBusinessObjectLabelByAnnotationId,
      soloTemplateId,
      soloAnnotationId,
      keepSoloDimmed,
      ignoreSolo,
      keepHiddenTemplates,
      tempAnnotations,
      bgImageTextAnnotations,
      baseMapAnnotationsOnly,
      excludeBgAnnotations,
      sortByOrderIndex,
      groupByBaseMap,
      listingsUpdatedAt,
      listingsById,
      subtractionTargetIdsBySource,
      openingRowsByHostId,
      excludeProfileTemplates,
      // TODO — stale entity labels on first load. `appConfig` is read inside
      // this query (entity `labelKey` + prefix/zeroPad, and the scope filter's
      // entityModel lookup) but is NOT a dependency: it loads asynchronously,
      // so the first run resolves entity-linked `label` to undefined and
      // nothing re-runs the query until an unrelated write happens. Affects
      // every consumer of `annotation.label` (panel header, listings…); the
      // "Etiquette" labels are immune since they read the row's own
      // `annotationLabel`.
      // Careful with the fix: adding `appConfig` itself makes this heavy query
      // depend on an OBJECT REFERENCE, so any re-set of the config (even with
      // identical content) triggers a full re-resolve of every annotation.
      // Prefer a derived, stable value — e.g. a loaded flag or a version key.
    ]);

    return processed;
  } catch (e) {
    console.log(e);
    return [];
  }
}
