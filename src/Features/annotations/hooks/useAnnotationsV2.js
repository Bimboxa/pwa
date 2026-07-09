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

const _annotationsRowsCache = new Map(); // queryKey -> Promise<rows[]>
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

const _invalidateAnnotationRows = () => {
  _sawLocalWrite = true;
  _annotationsRowsCache.clear();
};
db.annotations.hook("creating", _invalidateAnnotationRows);
db.annotations.hook("updating", _invalidateAnnotationRows);
db.annotations.hook("deleting", _invalidateAnnotationRows);
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
import resolveCuts from "Features/annotations/utils/resolveCuts";
import resolveGuideLine from "Features/annotations/utils/resolveGuideLine";
import applyGuideLineRampToRings from "Features/annotations/utils/applyGuideLineRampToRings";

import db from "App/db/db";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import stabilizeAnnotationsIdentity from "Features/annotations/utils/stabilizeAnnotationsIdentity";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getAnnotationPropsFromAnnotationTemplateProps from "Features/annotations/utils/getAnnotationPropsFromAnnotationTemplateProps";
import getEntityWithImagesAsync from "Features/entities/services/getEntityWithImagesAsync";
import testObjectHasProp from "Features/misc/utils/testObjectHasProp";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import getAnnotationSubtractionQties from "Features/annotations/utils/getAnnotationSubtractionQties";
import getExtrusionProfileFootprintShapes from "Features/annotations/utils/getExtrusionProfileFootprintShapes";
import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import { getShape3DKey } from "Features/annotations/constants/shape3DConfig";
import { resolveProfileFromDb } from "Features/annotations/hooks/useProfileResolution";
import computeSubtractedSurfaceM2Async from "Features/threedEditor/js/utilsAnnotationsManager/computeSubtractedSurfaceM2Async";
import pixelToWorld from "Features/threedEditor/js/utilsAnnotationsManager/pixelToWorld";
import getRevolutionPhi, {
  normalizeSpan as normalizeRevolutionSpan,
} from "Features/threedEditor/js/utilsAnnotationsManager/getRevolutionPhi";
import baseMapLocalToWorld from "Features/baseMaps/js/baseMapLocalToWorld";
import baseMapWorldToLocal from "Features/baseMaps/js/baseMapWorldToLocal";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";

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
    // rather than hiding them outright.
    const keepSoloDimmed = options?.keepSoloDimmed;
    // Skip the solo filter entirely. Used by the listings panel, which needs a
    // solo-independent set of visible annotations (soloing must not remove rows
    // from the panel tree or shrink its counts).
    const ignoreSolo = options?.ignoreSolo;

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

    const hiddenLayerIds = useSelector((s) => s.layers?.hiddenLayerIds || []);
    const showAnnotationsWithoutLayer = useSelector(
      (s) => s.layers?.showAnnotationsWithoutLayer ?? true
    );
    const layersUpdatedAt = useSelector((s) => s.layers?.layersUpdatedAt);

    const listingsUpdatedAt = useSelector((s) => s.listings.listingsUpdatedAt);

    const soloMode = useSelector((s) => s.popperMapListings.soloMode);
    const soloVisibleTemplateIds = useSelector(
      (s) => s.popperMapListings.soloVisibleTemplateIds
    );
    const soloListingId = useSelector((s) => s.popperMapListings.soloListingId);

    const { targetIdsBySource: subtractionTargetIdsBySource } =
      useAnnotationSubtractions();

    const { value: baseMaps, baseMapsUpdatedAt } = useBaseMaps();
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

      // Timing: when this run STARTED (vs the TOTAL log at completion) — to
      // tell scheduling latency apart from execution time.
      const _tStart = performance.now();
      console.log(
        `[debug_perf] stageA start [${_caller}] @${_tStart.toFixed(0)}`
      );

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
        let rowsPromise = _annotationsRowsCache.get(queryKey);
        _annRowsSharedHit = Boolean(rowsPromise);
        if (!rowsPromise) {
          rowsPromise = fetcher().catch((e) => {
            _annotationsRowsCache.delete(queryKey);
            throw e;
          });
          _annotationsRowsCache.set(queryKey, rowsPromise);
        }
        return [...(await rowsPromise)];
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

      // Revolution helpers (REVOLUTION_AXIS / REVOLUTION_POINT) are
      // project-level geometry drawn from the découpe tools. They are not
      // bound to a listing / layer / scope, so they bypass the
      // listing/layer/scope visibility filters below and stay visible on
      // their base map.
      const isRevolutionHelper = (a) =>
        a?.type === "REVOLUTION_AXIS" || a?.type === "REVOLUTION_POINT";

      // layer visibility filter
      if (hiddenLayerIds.length > 0 || !showAnnotationsWithoutLayer) {
        _annotations = _annotations.filter((a) => {
          if (a.isBaseMapAnnotation || isRevolutionHelper(a)) return true;
          if (!a.layerId) return showAnnotationsWithoutLayer;
          return !hiddenLayerIds.includes(a.layerId);
        });
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
              return em?.type === "BASE_MAP" || l.scopeId === scope?.id;
            })
            .map((l) => l.id)
        );
        _annotations = _annotations.filter(
          (a) =>
            a.isBaseMapAnnotation ||
            // Revolution helpers are project-level geometry (drawn from
            // the découpe tools, no listing scope) — always keep them.
            isRevolutionHelper(a) ||
            scopeListingIds.has(a.listingId)
        );
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

          // --- POINT (and plan-view revolution axis marker)
          else if (
            _annotation.type === "POINT" ||
            _annotation.type === "REVOLUTION_POINT"
          ) {
            _annotation.point = resolvePoints({
              points: [annotation.point],
              pointsIndex,
              imageSize,
            })[0];
            if (!_isResolved(_annotation.point) && _annotation.point?.id)
              corruptedIds.push(_annotation.point.id);
          }

          // --- LABELS
          else if (_annotation.type === "LABEL") {
            _annotation.targetPoint = {
              x: annotation.targetPoint.x * width,
              y: annotation.targetPoint.y * height,
            };
            _annotation.labelPoint = {
              x: annotation.labelPoint.x * width,
              y: annotation.labelPoint.y * height,
            };
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
            if (_annotation.cuts)
              _annotation.cuts = resolveCuts({
                cuts: annotation.cuts,
                pointsIndex,
                imageSize,
              })
                ?.map((cut) => ({
                  ...cut,
                  points: _splitResolved(cut?.points, corruptedIds),
                }))
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

            // guideLines ramp: derive each vertex's offsetTop from its
            // projection onto the nearest guideLine (height accumulates
            // along the ordered lines) so the sloped surface is a pure
            // function of position (iso-lines normal to the guideLines)
            // and stays correct when the contour is edited.
            if (
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

        console.log(
          `[debug_perf]   entities detail: db.entities=${(_te1 - _te0).toFixed(1)}ms (${Object.keys(entityCache).length} entities, ${_fetchedCount} fetched) | db.files=${(_te2 - _te1).toFixed(1)}ms (${entityFilesArray.length} files)`
        );

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
                label,
              };
            } else {
              return annotation;
            }
          })
        );
      }

      const _t6 = performance.now();
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

      // -- EXTRUSION_PROFILE SUBTRACTION SOURCES (developed surface) --
      // For EXTRUSION_PROFILE hosts that subtract other annotations, the
      // carved quantity is a developed surface (not a footprint). Resolve
      // the profile length (so the base surface is computed) and run the
      // same headless 3D carve to get the removed m². Both are stored and
      // applied to qties in the post-processing pass. Gated to withQties.
      if (
        withQties &&
        subtractionTargetIdsBySource?.size > 0 &&
        _annotations?.length
      ) {
        const profileLenCache = new Map();
        for (const a of _annotations) {
          const targetIds = subtractionTargetIdsBySource.get(a?.id);
          if (!targetIds || targetIds.length === 0) continue;
          if (getShape3DKey(a.shape3D) !== "EXTRUSION_PROFILE") continue;
          const targets = targetIds
            .map((id) => _annotations.find((x) => x?.id === id))
            .filter(Boolean);
          if (targets.length === 0) continue;
          const bm = baseMapById[a.baseMapId];
          const imageSize = bm?.getImageSize?.() || bm?.image?.imageSize;
          const meterByPx = bm?.getMeterByPx?.();
          if (!imageSize?.width || !meterByPx) continue;
          const baseMapForRender = {
            imageWidth: imageSize.width,
            imageHeight: imageSize.height,
            meterByPx,
          };
          const tplId = a.shape3D?.profileTemplateId;
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
            const removed = await computeSubtractedSurfaceM2Async(
              a,
              baseMapForRender,
              targets
            );
            if (removed != null) a._subtractedSurfaceM2 = removed;
          } catch (e) {
            console.error(
              "[useAnnotationsV2] profile subtraction qty failed",
              e
            );
          }
        }
      }

      // -- REVOLUTION (axis-based) resolution --
      // For arcs whose shape3D references a REVOLUTION_AXIS, attach:
      //   - revolutionAxisPoints: the axis line resolved to pixels (same
      //     base map as the arc) so the 3D builder can derive the radius.
      //   - revolutionCenterLocal: the arc-base-map-local metre position
      //     of the revolution axis, taken from the linked REVOLUTION_POINT
      //     (plan view). Null when no point references the axis → the 3D
      //     builder falls back to the elevation drawing's own location.
      if (_annotations?.length) {
        for (const arc of _annotations) {
          if (!arc || getShape3DKey(arc.shape3D) !== "REVOLUTION") continue;
          const axisId = arc.shape3D?.axisAnnotationId;
          if (!axisId) continue;

          const axis = await db.annotations.get(axisId);
          if (!axis || axis.deletedAt) continue;

          const arcBaseMap = baseMapById[arc.baseMapId];
          const arcImageSize =
            arcBaseMap?.getImageSize?.() || arcBaseMap?.image?.imageSize;
          if (!arcImageSize) continue;

          arc.revolutionAxisPoints = resolvePoints({
            points: axis.points,
            pointsIndex,
            imageSize: arcImageSize,
          });

          // Linked plan-view point (first match wins).
          const pointAnn = await db.annotations
            .where("projectId")
            .equals(projectId)
            .filter(
              (a) =>
                !a.deletedAt &&
                a.type === "REVOLUTION_POINT" &&
                a.revolutionAxisId === axisId
            )
            .first();

          if (pointAnn?.point?.id) {
            const ptBaseMap = baseMapById[pointAnn.baseMapId];
            const ptImageSize =
              ptBaseMap?.getImageSize?.() || ptBaseMap?.image?.imageSize;
            const ptDb = await db.points.get(pointAnn.point.id);
            if (ptBaseMap && ptImageSize && ptDb) {
              const ptPx = {
                x: ptDb.x * ptImageSize.width,
                y: ptDb.y * ptImageSize.height,
              };
              const ptLocalMeters = pixelToWorld(ptPx, {
                imageWidth: ptImageSize.width,
                imageHeight: ptImageSize.height,
                meterByPx: ptBaseMap.getMeterByPx(),
              });
              const world = baseMapLocalToWorld(
                ptLocalMeters,
                getBaseMapTransform(ptBaseMap)
              );
              const local = baseMapWorldToLocal(
                world,
                getBaseMapTransform(arcBaseMap)
              );
              arc.revolutionCenterLocal = {
                x: local.x,
                y: local.y,
                z: local.z,
              };
            }
          }
        }
      }

      // -- PROXY (plan "donut") resolution --
      // A proxy is a plan-view representation of a source arc revolved
      // around its axis. Everything is derived LIVE from the source arc +
      // the current REVOLUTION_POINT position, so moving the plan point
      // recomputes the donut (and the 3D mesh):
      //   - _inheritedQties: the source arc's revolution surface (shown
      //     instead of the donut's planar area),
      //   - points/cuts: the 2D annulus, recentred on the live point,
      //   - revolutionProxy3D: arc + axis in metres + the plan-local centre
      //     so the 3D builder lathes the REAL revolution (not the donut).
      // See createRevolutionProxiesOnPlan + createAnnotationObject3D.
      if (_annotations?.length) {
        for (const proxy of _annotations) {
          if (!proxy?.isProxy || !proxy.proxySourceAnnotationId) continue;

          const src = await db.annotations.get(proxy.proxySourceAnnotationId);
          if (!src || src.deletedAt) continue;

          const srcBaseMap = baseMapById[src.baseMapId];
          const srcImageSize =
            srcBaseMap?.getImageSize?.() || srcBaseMap?.image?.imageSize;
          const srcMeterByPx = srcBaseMap?.getMeterByPx?.();
          if (!srcImageSize || !srcMeterByPx) continue;

          const axisId = src.shape3D?.axisAnnotationId;
          const axis = axisId ? await db.annotations.get(axisId) : null;

          const ids = new Set();
          (src.points ?? []).forEach((p) => p?.id && ids.add(p.id));
          (axis?.points ?? []).forEach((p) => p?.id && ids.add(p.id));
          const arr = await db.points.bulkGet([...ids]);
          const idx = {};
          for (const p of arr) if (p) idx[p.id] = p;

          const srcPointsPx = resolvePoints({
            points: src.points,
            pointsIndex: idx,
            imageSize: srcImageSize,
          });
          const axisPx = axis
            ? resolvePoints({
                points: axis.points,
                pointsIndex: idx,
                imageSize: srcImageSize,
              })
            : null;

          // Partial-revolution range (stored on the SOURCE arc's shape3D).
          // Absent → full 360°.
          const partialRevolution = !!src.shape3D?.partialRevolution;
          const angleStart = src.shape3D?.revolutionAngleStart ?? 0;
          const angleEnd = src.shape3D?.revolutionAngleEnd ?? Math.PI * 2;
          const angleFraction = partialRevolution
            ? normalizeRevolutionSpan(angleEnd - angleStart) / (Math.PI * 2)
            : 1;

          // Inherited quantities = the source arc's revolution surface.
          proxy._inheritedQties = getAnnotationQties({
            annotation: {
              ...src,
              points: srcPointsPx,
              revolutionAxisPoints: axisPx,
            },
            meterByPx: srcMeterByPx,
          });
          // A partial revolution sweeps only a fraction of the full turn.
          if (partialRevolution && proxy._inheritedQties) {
            for (const key of ["surface", "surfaceDeveloped"]) {
              if (typeof proxy._inheritedQties[key] === "number") {
                proxy._inheritedQties[key] *= angleFraction;
              }
            }
          }

          // Fill colour = the linked polyline's (resolved) stroke colour, so the
          // donut reads as the same element. Applied after template override in
          // the post-processing memo (see _proxyFillColor).
          const srcTpl = src.annotationTemplateId
            ? await db.annotationTemplates.get(src.annotationTemplateId)
            : null;
          const srcResolved = getAnnotationPropsFromAnnotationTemplateProps(
            src,
            getAnnotationTemplateProps(srcTpl),
            srcBaseMap
          );
          proxy._proxyFillColor =
            srcResolved?.strokeColor || src.strokeColor || null;

          // Need the axis to project onto the plan.
          if (!axisPx || axisPx.length < 2 || !srcPointsPx?.length) continue;

          // Radii from the source arc (horizontal distance to the axis).
          const axisXpx = axisPx.reduce((s, p) => s + p.x, 0) / axisPx.length;
          const radiiPx = srcPointsPx.map((p) => Math.abs(p.x - axisXpx));
          const rMinM = Math.min(...radiiPx) * srcMeterByPx;
          const rMaxM = Math.max(...radiiPx) * srcMeterByPx;
          if (!(rMaxM > 0)) continue;

          // Plan baseMap + the LIVE REVOLUTION_POINT centre.
          const planBaseMap = baseMapById[proxy.baseMapId];
          const planImageSize =
            planBaseMap?.getImageSize?.() || planBaseMap?.image?.imageSize;
          const planMeterByPx = planBaseMap?.getMeterByPx?.();
          if (!planImageSize || !planMeterByPx) continue;

          const pointAnn = await db.annotations
            .where("projectId")
            .equals(projectId)
            .filter(
              (a) =>
                !a.deletedAt &&
                a.type === "REVOLUTION_POINT" &&
                a.revolutionAxisId === proxy.revolutionAxisId &&
                a.baseMapId === proxy.baseMapId
            )
            .first();
          const ptDb = pointAnn?.point?.id
            ? await db.points.get(pointAnn.point.id)
            : null;
          if (!ptDb) continue;

          const centerPx = {
            x: ptDb.x * planImageSize.width,
            y: ptDb.y * planImageSize.height,
          };

          // 2D donut, recomputed from the live centre + radii (so it
          // follows the plan point). S–C–S ring → smooth circle.
          const rOuterPx = rMaxM / planMeterByPx;
          const rInnerPx = rMinM / planMeterByPx;
          const ringPx = (r) => [
            { x: centerPx.x + r, y: centerPx.y, type: "square" },
            { x: centerPx.x, y: centerPx.y + r, type: "circle" },
            { x: centerPx.x - r, y: centerPx.y, type: "square" },
            { x: centerPx.x, y: centerPx.y - r, type: "circle" },
          ];
          proxy.points = ringPx(rOuterPx);
          proxy.cuts =
            rInnerPx > Math.max(1, rOuterPx * 0.02)
              ? [{ points: ringPx(rInnerPx) }]
              : [];

          // Sector descriptor consumed directly by NodeProxyRevolutionStatic
          // when partial. Full-ring points/cuts above stay as the total-mode
          // renderer + hit-test fallback.
          proxy.revolutionProxy2D = {
            center: centerPx,
            rOuter: rOuterPx,
            rInner: rInnerPx > Math.max(1, rOuterPx * 0.02) ? rInnerPx : 0,
            angleStart,
            angleEnd,
            partial: partialRevolution,
          };

          // 3D: lathe the SOURCE arc (not the donut). Convert arc + axis
          // to metres with the SOURCE scale (so radius/height match the
          // elevation), and place the lathe at the plan-local centre.
          const srcDims = {
            imageWidth: srcImageSize.width,
            imageHeight: srcImageSize.height,
            meterByPx: srcMeterByPx,
          };
          const planDims = {
            imageWidth: planImageSize.width,
            imageHeight: planImageSize.height,
            meterByPx: planMeterByPx,
          };
          const centerLocal2D = pixelToWorld(centerPx, planDims);
          proxy.revolutionProxy3D = {
            // Keep `type` so buildRevolutionMesh can sample S–C–S arcs.
            arcPointsLocal: srcPointsPx.map((p) => ({
              ...pixelToWorld(p, srcDims),
              type: p.type,
            })),
            axisPointsLocal: axisPx.map((p) => pixelToWorld(p, srcDims)),
            centerLocal: {
              x: centerLocal2D.x,
              y: centerLocal2D.y,
              z: 0,
            },
            hiddenSegmentsIdx: src.hiddenSegmentsIdx || [],
            // Partial revolution → cut the lathe to the same angular range.
            ...(partialRevolution
              ? getRevolutionPhi(angleStart, angleEnd)
              : {}),
          };
        }
      }

      // Observation reads were fired at the top of the callback — settle
      // them before returning so tracking is guaranteed registered and a
      // real read failure still surfaces.
      await _obsPromise;

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
      dbWriteTick,
    ]);

    // memoize post-processing to avoid recomputing on unrelated re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const processed = useMemo(() => {
      // skip post-processing when disabled
      if (!enabled || !annotations || annotations.length === 0) return [];

      // stage-B timing instrumentation (pure measurement, no behavior
      // change): one mark per block, summary logged below when total >= 5ms.
      const _tB0 = performance.now();

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

      // Proxy "donut": fill (and stroke) take the linked polyline's stroke
      // colour. Applied AFTER the template override so it isn't clobbered, and
      // before qties/3D so the revolution mesh (makeMaterial reads fillColor)
      // gets the right colour too.
      result = result.map((a) => {
        if (a?.isProxy && a._proxyFillColor) {
          return {
            ...a,
            fillColor: a._proxyFillColor,
            strokeColor: a._proxyFillColor,
          };
        }
        return a;
      });

      const _tB1 = performance.now(); // template override (+ proxy fill)

      // recompute qties after template overrides so overridden height is reflected
      if (withQties) {
        // NOTE: no in-place `annotation.qties = ...` here — the identity
        // stabilization cache below compares this run's output against the
        // previous run's cached objects, so stage-B must never mutate
        // objects it may have returned before.
        result = result.map((annotation) => {
          if (annotation?.isBaseMapAnnotation) return annotation;
          // Proxy donuts inherit the source arc's revolution surface
          // (precomputed in the async query). The donut's own planar
          // area is intentionally NOT used.
          if (annotation?.isProxy && annotation._inheritedQties) {
            return { ...annotation, qties: annotation._inheritedQties };
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

      const _tB2 = performance.now(); // withQties recompute

      // -- SUBTRACTIONS --
      // Attach subtraction relations (targetIds + resolved target
      // annotations) so the 3D pipeline can carve the source mesh and the
      // surface quantity reflects the boolean difference.
      if (subtractionTargetIdsBySource?.size > 0) {
        const resultById = getItemsByKey(result, "id");
        result = result.map((a) => {
          const targetIds = subtractionTargetIdsBySource.get(a?.id);
          if (!targetIds || targetIds.length === 0) return a;
          const subtractionTargets = targetIds
            .map((id) => resultById[id])
            .filter(Boolean);
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
          if (
            withQties &&
            subtractionTargets.length > 0 &&
            isFootprintSurfaceType
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
          return withSub;
        });
      }

      const _tB3 = performance.now(); // subtractions

      // filter out annotations whose template is hidden
      result = result.filter((a) => !a.hidden);

      // exclude profile-template annotations (3D viewer only — they stay
      // visible in 2D, but are dropped from the 3D scene)
      if (excludeProfileTemplates) {
        result = result.filter(
          (a) =>
            a.isBaseMapAnnotation ||
            !annotationTemplatesMap[a.annotationTemplateId]?.isProfile
        );
      }

      // solo mode: keep only annotations whose template is in the visible
      // set. The 3D viewer passes `keepSoloDimmed` to instead keep them all
      // and tag the non-soloed ones with `_soloDimmed`, so
      // ThreedSelectionDimmer renders them translucent while the soloed
      // template keeps its original material.
      if (
        !ignoreSolo &&
        soloMode &&
        soloVisibleTemplateIds != null &&
        soloListingId
      ) {
        const soloSet = new Set(soloVisibleTemplateIds);
        // Solo isolates the soloed template(s) across the WHOLE view:
        // every other annotation is affected, not just those in the same
        // listing. Base-map (background) annotations are always kept.
        const isInSolo = (a) =>
          a.isBaseMapAnnotation || soloSet.has(a.annotationTemplateId);
        if (keepSoloDimmed) {
          result = result.map((a) =>
            isInSolo(a) ? a : { ...a, _soloDimmed: true }
          );
        } else {
          result = result.filter(isInSolo);
        }
      }

      const _tB4 = performance.now(); // hidden/profile/solo filters

      // override with temp annotations
      result = [...result, ...(tempAnnotations ?? [])];

      // bg image text annotations
      if (!baseMapAnnotationsOnly && !excludeBgAnnotations)
        result = [...result, ...(bgImageTextAnnotations ?? [])];

      // sort by listing rank, then template order, with manual orderIndex as top priority
      if (sortByOrderIndex) {
        // listing order map (by rank)
        const listingOrderMap = new Map();
        if (_listingsCache.listings?.length) {
          [..._listingsCache.listings]
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

      const _tB5 = performance.now(); // order maps + sort (+ groupByBaseMap)

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

      // Summary — only when stage B is actually expensive (it re-runs on
      // every consumer re-render at ~1ms; logging those would flood the
      // console and evict the interesting lines from its buffer).
      const _tB6 = performance.now();
      const _stageBTotal = _tB6 - _tB0;
      if (_stageBTotal >= 5) {
        console.log(
          `[debug_perf] useAnnotationsV2 [${_caller}] stage B: ${_stageBTotal.toFixed(1)}ms (N=${result.length}) | override ${(_tB1 - _tB0).toFixed(1)} | qties ${(_tB2 - _tB1).toFixed(1)} | subtractions ${(_tB3 - _tB2).toFixed(1)} | filters ${(_tB4 - _tB3).toFixed(1)} | sort ${(_tB5 - _tB4).toFixed(1)} | stability ${(_tB6 - _tB5).toFixed(1)}`
        );
      }

      return stableResult;
    }, [
      enabled,
      annotations,
      annotationTemplatesMap,
      baseMapById,
      withQties,
      soloMode,
      soloVisibleTemplateIds,
      soloListingId,
      keepSoloDimmed,
      ignoreSolo,
      tempAnnotations,
      bgImageTextAnnotations,
      baseMapAnnotationsOnly,
      excludeBgAnnotations,
      sortByOrderIndex,
      groupByBaseMap,
      listingsUpdatedAt,
      subtractionTargetIdsBySource,
      excludeProfileTemplates,
    ]);

    return processed;
  } catch (e) {
    console.log(e);
    return [];
  }
}
