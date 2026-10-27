/* eslint-disable react/prop-types */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import { setScan3dTab } from "Features/rightPanel/rightPanelSlice";
import { toggleScene3dHiddenIn3d } from "Features/threedEditor/threedEditorSlice";
import { setBaseMapsScanMode } from "Features/viewers/viewersSlice";
import useToggleModuleEditor from "Features/viewers/hooks/useToggleModuleEditor";
import { Vector3 } from "three";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import Scan3dEmptyState from "./Scan3dEmptyState";
import Scan3dHeader from "./Scan3dHeader";
import LocalScanSliceSection from "./LocalScanSliceSection";
import TabScanGeneral from "./TabScanGeneral";
import TabScanPosition from "./TabScanPosition";
import DialogPickLocalScan from "./DialogPickLocalScan";
import DialogLocalScanZone from "./DialogLocalScanZone";
import useScanProjection from "../hooks/useScanProjection";
import inspectLocalScan from "../services/inspectLocalScan";
import readLocalScanInWorker from "../services/readLocalScanInWorker";
import createLocalScanView from "../services/createLocalScanView";
import localScanRuntime from "../services/localScanRuntime";
import { deleteLocalScan } from "../services/localScanStore";
import resources, {
  listAvailableScans,
  getAvailableScanSource,
} from "../services/scanResources";
import {
  getScanPanelHost,
  subscribeScanPanelHost,
} from "../services/scanPanelHost";
import sliceImageFile from "../utils/sliceImageFile";
import { getScanZonePlacement } from "../utils/localScanZone";
import { DEFAULT_LOCAL_SCAN_PLACEMENT as DEFAULT_PLACEMENT } from "../constants/localScanPlacement";
import { getLocalScanWorldMatrix } from "../utils/getLocalScanMatrixInBaseMap";
import getLocalScanPlacementFromMatrix from "../utils/getLocalScanPlacementFromMatrix";
import db from "App/db/db";

// Display stored on the resource (the mode is the shared bottom bar state).
const DEFAULT_DISPLAY = { pointSize: 2 };

// Placement of the scan glued to a base map, at the base map's current pose.
const getLinkedPlacement = (baseMap, up) =>
  getLocalScanPlacementFromMatrix(getLocalScanWorldMatrix(baseMap), up);

const samePlacement = (a, b) =>
  a.up === b.up &&
  [
    [a.scale, b.scale],
    [a.yaw, b.yaw],
    ...[0, 1, 2].map((i) => [a.origin?.[i] ?? 0, b.origin?.[i] ?? 0]),
  ].every(([x, y]) => Math.abs(x - y) < 1e-6);

// inactive: the 2D view is displayed — the scan stays loaded (and placed)
// but inspection, projection and overlays pause until the 3D comes back.
export default function LocalScansPanel({
  editor,
  projectId,
  hidden = false,
  inactive = false,
}) {
  // data
  const dispatch = useDispatch();
  const axesYaw = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
  const tab = useSelector((s) => s.rightPanel.scan3dTab) ?? "GENERAL";
  // Selected base map projected from a local scan: the panel follows it.
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const linkedBaseMap =
    useLiveQuery(async () => {
      if (!mainBaseMapId) return null;
      const record = await db.baseMaps.get(mainBaseMapId);
      return record?.localScan?.matrix && !record.deletedAt ? record : null;
    }, [mainBaseMapId]) ?? null;
  // Points / Réaliste: one state with the bottom bar « Scan 3D » selector
  // (Masqué or never chosen show the points here; the eye hides the scan).
  const scanMode = useSelector((s) => s.viewers.baseMapsScanMode);
  // « Scan » chips of the base maps list (hidden scans).
  const hiddenScanIds = useSelector(
    (s) => s.threedEditor.hiddenScene3dBaseMapIdsIn3d
  );
  const host = useSyncExternalStore(subscribeScanPanelHost, getScanPanelHost);
  const toggleEditor = useToggleModuleEditor();
  const paused = hidden || inactive;

  // state
  const [view, setView] = useState(null),
    viewRef = useRef(null);
  const [loaded, setLoaded] = useState(null);
  const [placement, setPlacement] = useState(DEFAULT_PLACEMENT);
  const [mode, setMode] = useState("POINTS");
  // Visibility of a scan not linked to a base map yet (before its creation).
  const [unlinkedVisible, setUnlinkedVisible] = useState(true);
  const [pointSize, setPointSize] = useState(2);
  // One visibility per scan base map: linked, the panel eye IS the « Scan »
  // chip of the selected base map.
  const linkedId =
    linkedBaseMap &&
    view &&
    loaded?.resourceId === linkedBaseMap.localScan.resourceId
      ? linkedBaseMap.id
      : null;
  const modelVisible = linkedId
    ? !(hiddenScanIds ?? []).includes(linkedId)
    : unlinkedVisible;
  // Mode the view should render: Réaliste needs Gaussian data.
  const wantedMode =
    loaded?.kind === "SPLAT" && scanMode === "SPLAT" ? "SPLAT" : "POINTS";
  const failedSplatRef = useRef(null);
  const [inspection, setInspection] = useState(false);
  const [picked, setPicked] = useState(null),
    [pickMessage, setPickMessage] = useState(null);
  const [projectionActive, setProjectionActive] = useState(false);
  const [zoneRequest, setZoneRequest] = useState(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(null);
  const [picker, setPicker] = useState(false),
    [available, setAvailable] = useState([]);
  const inputRef = useRef(null),
    sourceRef = useRef(null),
    surfaceRef = useRef(null);
  const abortRef = useRef(null),
    epochRef = useRef(0),
    // Reference on the shared decoded scan (localScanRuntime), if saved.
    scanHandleRef = useRef(null);
  const canInspect = Boolean(
    inspection &&
    modelVisible &&
    tab === "POSITION" &&
    host &&
    view &&
    !busy &&
    !paused
  );
  const projection = useScanProjection({
    editor,
    view,
    axesYaw,
    placementKey: JSON.stringify(placement),
    active: projectionActive,
    inspect: canInspect,
    hidden: paused || busy,
    showBounds: Boolean(
      host && tab === "PROJECTION" && !busy && !inactive && modelVisible
    ),
  });

  // helpers
  useEffect(
    () => () => {
      epochRef.current++;
      abortRef.current?.abort();
      viewRef.current?.dispose();
      viewRef.current = null;
      scanHandleRef.current?.release();
      scanHandleRef.current = null;
      sourceRef.current = null;
    },
    [editor, projectId]
  );
  useEffect(() => {
    if (tab === "PROJECTION" && view) setProjectionActive(true);
  }, [tab, view]);
  useEffect(() => {
    view?.setVisible(modelVisible);
  }, [view, modelVisible]);
  // Follow the shared mode (bottom bar or this panel); a failed realistic
  // decode is not retried for the same view.
  useEffect(() => {
    if (!view || busy || wantedMode === mode) return;
    if (wantedMode === "SPLAT" && failedSplatRef.current === view) return;
    void changeMode(wantedMode);
  }, [view, busy, wantedMode, mode]);
  // The tool shows this scan itself: its base maps leave it out (no double).
  const toolResourceId = view ? (loaded?.resourceId ?? null) : null;
  // Linked to the selected scan base map: same scan, placed at the base map
  // pose (so it follows the 2D / 3D moves of the map), slice of its image,
  // « Mettre à jour le fond de plan » instead of the creation.
  const linked =
    linkedBaseMap &&
    loaded?.resourceId === linkedBaseMap.localScan.resourceId &&
    view
      ? linkedBaseMap
      : null;
  const linkPoseKey = linkedBaseMap
    ? JSON.stringify([
        linkedBaseMap.id,
        linkedBaseMap.position,
        linkedBaseMap.angleDeg,
        linkedBaseMap.orientation,
        linkedBaseMap.localScan,
      ])
    : "";
  const linkTriedRef = useRef(null),
    // Last base map pose applied to the tool: a pending alignment (« Mettre à
    // jour » not clicked yet) survives mode changes and 2D / 3D switches.
    poseAppliedRef = useRef(null),
    rangeAppliedRef = useRef(null);
  useEffect(() => {
    if (!linkedBaseMap) linkTriedRef.current = null;
  }, [linkedBaseMap]);
  useEffect(() => {
    if (!linkedBaseMap || inactive || busy) return;
    const { resourceId } = linkedBaseMap.localScan;
    if (view && loaded?.resourceId === resourceId) {
      if (poseAppliedRef.current === linkPoseKey) return;
      poseAppliedRef.current = linkPoseKey;
      const next = getLinkedPlacement(linkedBaseMap, placement.up);
      if (samePlacement(next, placement)) return;
      view.setPlacement(next);
      setPlacement(next);
      return;
    }
    // Open the scan of the selected base map, once per selection.
    if (linkTriedRef.current === linkedBaseMap.id) return;
    linkTriedRef.current = linkedBaseMap.id;
    resources.get(resourceId).then((row) => {
      if (row && !row.deletedAt) void load(null, row, { link: linkedBaseMap });
      else
        setError(
          "Le scan de ce fond de plan n’est plus dans les ressources du projet."
        );
    });
    // placement / load are read at the pose or selection change only.
  }, [linkPoseKey, loaded?.resourceId, view, inactive, busy]);
  useEffect(() => {
    if (!linked || !projection.frame) return;
    const key = `${linked.id}|${projection.verticalKey}`;
    if (rangeAppliedRef.current === key) return;
    rangeAppliedRef.current = key;
    const { lower, upper, mode: imageMode } = linked.createdFrom ?? {};
    if (Number.isFinite(lower) && Number.isFinite(upper))
      projection.changeRange([lower, upper]);
    if (imageMode) projection.setMode(imageMode);
  }, [linked, projection]);
  useEffect(() => {
    const imagesManager = editor?.sceneManager?.imagesManager;
    if (!imagesManager || !toolResourceId) return;
    imagesManager.setLocalScanState({ toolResourceId });
    return () => imagesManager.setLocalScanState({ toolResourceId: null });
  }, [editor, toolResourceId]);
  useEffect(() => {
    if (!canInspect || !surfaceRef.current) return;
    try {
      return inspectLocalScan(
        editor,
        view,
        surfaceRef.current,
        (point, message) => {
          setPicked(point);
          setPickMessage(message);
        }
      );
    } catch {
      setPickMessage(
        "Le relevé n’a pas pu démarrer. Réactivez le switch pour réessayer."
      );
    }
  }, [canInspect, editor, view]);
  useEffect(() => {
    if (!picker) return;
    let alive = true;
    listAvailableScans(projectId)
      .then((rows) => {
        if (alive) setAvailable(rows);
      })
      .catch(() => {
        if (alive) setError("Impossible de lire les ressources locales.");
      });
    return () => {
      alive = false;
    };
  }, [picker, projectId]);

  // handlers
  function closeScan() {
    epochRef.current++;
    abortRef.current?.abort();
    viewRef.current?.dispose();
    viewRef.current = null;
    scanHandleRef.current?.release();
    scanHandleRef.current = null;
    setView(null);
    sourceRef.current = null;
    setLoaded(null);
    setBusy(false);
    setPicked(null);
    setPickMessage(null);
    setInspection(false);
    setProjectionActive(false);
    dispatch(setScan3dTab("GENERAL"));
  }
  // Opens the zone dialog; resolves {zone, wholePolygon}, rejects with an
  // AbortError when cancelled (dialog closed or load superseded).
  function requestZone(file, initialZone, signal) {
    return new Promise((resolve, reject) => {
      const finish = () => {
        signal.removeEventListener("abort", abort);
        setZoneRequest(null);
      };
      const abort = () => {
        finish();
        reject(new DOMException("Import cancelled", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      setZoneRequest({
        file,
        initialZone,
        onConfirm: (result) => {
          finish();
          resolve(result);
        },
        onCancel: abort,
      });
    });
  }
  // link: the selected scan base map whose scan is opened (no zone dialog,
  // placement = the base map pose).
  async function load(
    file,
    resource = null,
    { editZone = false, link = null } = {}
  ) {
    const epoch = ++epochRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPicker(false);
    setBusy(true);
    setProgress(0);
    setError(null);
    let nextView,
      handle = null;
    try {
      const source = file ?? (await getAvailableScanSource(resource));
      if (!source)
        throw new Error(
          "Le fichier de cette ressource est absent de cet appareil. Rechargez-le depuis Ressources."
        );
      if (epoch !== epochRef.current) return;
      // A saved zone is reapplied as is; a new source (or « Modifier la
      // zone ») goes through the zone dialog first.
      const savedZone = resource?.legacy ? null : resource?.scan?.zone;
      let zone = savedZone,
        zoneChosen = null;
      if ((!savedZone && !link) || editZone) {
        zoneChosen = await requestZone(source, savedZone, controller.signal);
        zone = zoneChosen.zone;
      }
      if (epoch !== epochRef.current) return;
      // A saved scan reopened as is may already be decoded for a scan base
      // map: share it.
      const reopening = Boolean(resource && !resource.legacy && !zoneChosen);
      let data;
      if (reopening) {
        handle = localScanRuntime.acquire(resource, {
          onProgress: setProgress,
        });
        ({ data } = await handle.promise);
      } else
        data = await readLocalScanInWorker(source, {
          signal: controller.signal,
          onProgress: setProgress,
          read: { zone },
        });
      if (epoch !== epochRef.current) return;
      const nextPlacement = {
        ...DEFAULT_PLACEMENT,
        ...(resource?.legacy
          ? {
              up: resource.up,
              scale: resource.scale,
              origin: resource.origin ?? [0, 0, 0],
              yaw: resource.yaw ?? 0,
            }
          : resource?.scan?.placement),
        ...(zoneChosen &&
          getScanZonePlacement(zone, axesYaw, zoneChosen.wholePolygon)),
      };
      if (link)
        Object.assign(
          nextPlacement,
          getLinkedPlacement(link, nextPlacement.up)
        );
      let saved = resource && !resource.legacy ? resource : null;
      if (saved && zoneChosen) {
        try {
          await resources.update(saved.id, {
            zone,
            placement: nextPlacement,
            count: data.count,
            bounds: data.bounds,
          });
        } catch {
          setError("La zone n’a pas pu être enregistrée dans la ressource.");
        }
      }
      if (!saved) {
        try {
          saved = await resources.save({
            projectId,
            file: source,
            data,
            placement: nextPlacement,
            zone,
            legacyKey: resource?.contextKey,
            signal: controller.signal,
          });
          // The resource transaction has committed before releasing the legacy copy.
          if (resource?.legacy)
            await deleteLocalScan(resource.contextKey).catch(() => {});
        } catch (failure) {
          if (failure.name === "AbortError") throw failure;
          setError(
            "Modèle ouvert, mais non enregistré : stockage local indisponible ou espace insuffisant."
          );
        }
      }
      if (epoch !== epochRef.current) return;
      if (saved && !reopening) {
        handle = localScanRuntime.seed(
          { id: saved.id, scan: { zone } },
          { data, source }
        );
        ({ data } = await handle.promise);
      }
      const display = {
        ...DEFAULT_DISPLAY,
        ...(!resource?.legacy && resource?.scan?.display),
      };
      nextView = createLocalScanView(editor, data);
      nextView.setPlacement(nextPlacement);
      nextView.setPointSize(display.pointSize);
      viewRef.current?.dispose();
      viewRef.current = nextView;
      scanHandleRef.current?.release();
      scanHandleRef.current = handle;
      sourceRef.current = source;
      setView(nextView);
      setPlacement(nextPlacement);
      setLoaded({
        name: source.name,
        size: source.size,
        count: data.count,
        kind: data.kind,
        resourceId: saved?.id,
      });
      setMode("POINTS");
      setPointSize(display.pointSize);
      setUnlinkedVisible(true);
      setInspection(false);
      setPicked(null);
      setPickMessage(null);
      setProjectionActive(false);
      dispatch(setScan3dTab("GENERAL"));
      await nextView.fit();
    } catch (failure) {
      if (viewRef.current !== nextView) nextView?.dispose();
      if (epoch === epochRef.current && failure.name !== "AbortError")
        setError(failure.message);
    } finally {
      if (handle && handle !== scanHandleRef.current) handle.release();
      if (epoch === epochRef.current) setBusy(false);
    }
  }
  async function editZone() {
    if (busy) return;
    const row = loaded?.resourceId
      ? await resources.get(loaded.resourceId)
      : null;
    if (row) await load(null, row, { editZone: true });
    else if (sourceRef.current) await load(sourceRef.current);
  }
  async function saveCurrent() {
    if (!view || !sourceRef.current || busy) return;
    const epoch = epochRef.current;
    setBusy(true);
    setError(null);
    try {
      const row = await resources.save({
        projectId,
        file: sourceRef.current,
        data: view.data,
        placement,
      });
      if (epoch === epochRef.current)
        setLoaded((previous) => ({ ...previous, resourceId: row.id }));
    } catch (failure) {
      if (epoch === epochRef.current) setError(failure.message);
    } finally {
      if (epoch === epochRef.current) setBusy(false);
    }
  }
  async function place(patch) {
    const next = { ...placement, ...patch };
    if (!Number.isFinite(next.scale) || next.scale <= 0 || next.scale > 1000)
      return;
    view?.setPlacement(next);
    setPlacement(next);
    // Linked: the base map owns the pose — saved by « Mettre à jour ».
    if (loaded?.resourceId && !linked) {
      try {
        await resources.place(loaded.resourceId, next);
      } catch {
        setError("Le placement n’a pas pu être enregistré dans la ressource.");
      }
    }
  }
  async function saveDisplay(patch) {
    if (!loaded?.resourceId) return;
    try {
      await resources.update(loaded.resourceId, {
        display: { pointSize, ...patch },
      });
    } catch {
      setError("L’affichage n’a pas pu être enregistré dans la ressource.");
    }
  }
  async function changeMode(next) {
    if (!next || !view || busy) return;
    const target = view;
    const epoch = epochRef.current;
    setBusy(true);
    setError(null);
    try {
      await target.setMode(next, sourceRef.current);
      if (epoch === epochRef.current) setMode(next);
    } catch (failure) {
      if (epoch === epochRef.current) {
        failedSplatRef.current = target;
        setError(`Rendu réaliste indisponible : ${failure.message}`);
        await target.setMode("POINTS");
        setMode("POINTS");
      }
    } finally {
      if (epoch === epochRef.current) setBusy(false);
    }
  }
  function toggleVisible() {
    if (linkedId) dispatch(toggleScene3dHiddenIn3d(linkedId));
    else setUnlinkedVisible(!unlinkedVisible);
  }
  function changePointSize(size) {
    setPointSize(size);
    view.setPointSize(size);
    void saveDisplay({ pointSize: size });
  }
  function changeInspection(value) {
    setInspection(value);
    setPicked(null);
    setPickMessage(null);
  }
  function rotate(delta) {
    setInspection(false);
    void place({
      yaw: ((((placement.yaw + delta + 180) % 360) + 360) % 360) - 180,
    });
  }
  async function download(mode) {
    if (!projection.current) return;
    try {
      const file = await sliceImageFile(
        projection.result,
        mode,
        `scan-${mode}.png`
      );
      const url = URL.createObjectURL(file),
        link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure.message);
    }
  }

  // render
  const worldPoint =
    picked && view
      ? view.root.localToWorld(new Vector3(...picked.point))
      : null;
  const coordinates = worldPoint
    ? getUserAxesWorldDirections(axesYaw).map(({ key, dir }) => ({
        key,
        value: worldPoint.dot(dir),
      }))
    : [];
  const body = (
    <>
      <Scan3dHeader
        model={loaded}
        busy={busy}
        onFrame={() => view?.fit()}
        onNew={() => setPicker(true)}
        onCloseModel={closeScan}
        onSave={saveCurrent}
        onEditZone={() => void editZone()}
      />
      <input
        ref={inputRef}
        type="file"
        accept=".ply"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void load(file);
        }}
      />
      {loaded && !inactive && (
        <Tabs
          value={tab}
          onChange={(_, value) => dispatch(setScan3dTab(value))}
          variant="fullWidth"
          sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider" }}
        >
          <Tab value="GENERAL" label="Général" />
          <Tab value="PROJECTION" label="Projection" />
          <Tab value="POSITION" label="Position" />
        </Tabs>
      )}
      <Stack
        spacing={1.5}
        sx={{
          p: 1.5,
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          bgcolor: "background.default",
        }}
      >
        {error && (
          <Alert severity="warning" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {busy && (
          <>
            <LinearProgress
              variant={progress > 0 ? "determinate" : "indeterminate"}
              value={progress * 100}
            />
            <Typography variant="caption">Préparation du modèle…</Typography>
            <Button onClick={closeScan}>Annuler et fermer</Button>
          </>
        )}
        {!loaded && !busy && (
          <Scan3dEmptyState
            onLoad={inactive ? toggleEditor : () => setPicker(true)}
          />
        )}
        {loaded && !busy && inactive && (
          <Alert
            severity="info"
            action={
              <Button color="inherit" size="small" onClick={toggleEditor}>
                Afficher la 3D
              </Button>
            }
          >
            Le scan reste chargé. Passez en 3D pour le manipuler.
          </Alert>
        )}
        {loaded && !busy && !inactive && (
          <>
            {tab === "GENERAL" && (
              <TabScanGeneral
                loaded={loaded}
                linkedBaseMap={linked}
                view={view}
                mode={wantedMode}
                pointSize={pointSize}
                modelVisible={modelVisible}
                projection={projection}
                onToggleVisible={toggleVisible}
                onChangeMode={(value) => {
                  if (value) dispatch(setBaseMapsScanMode(value));
                }}
                onChangePointSize={changePointSize}
                onDownload={download}
              />
            )}
            {tab === "PROJECTION" && (
              <LocalScanSliceSection
                projection={projection}
                onDownload={download}
              />
            )}
            {tab === "POSITION" && (
              <TabScanPosition
                placement={placement}
                inspection={inspection}
                picked={picked}
                pickMessage={pickMessage}
                coordinates={coordinates}
                projection={projection}
                onPlace={(patch) => {
                  if ("origin" in patch || "yaw" in patch) setInspection(false);
                  void place(patch);
                }}
                onInspectionChange={changeInspection}
                onRotate={rotate}
              />
            )}
          </>
        )}
      </Stack>
      {zoneRequest && (
        <DialogLocalScanZone
          file={zoneRequest.file}
          initialZone={zoneRequest.initialZone}
          onConfirm={zoneRequest.onConfirm}
          onCancel={zoneRequest.onCancel}
        />
      )}
      <DialogPickLocalScan
        open={picker}
        available={available}
        onClose={() => setPicker(false)}
        onChooseFile={() => inputRef.current?.click()}
        onPick={(row) => void load(null, row)}
      />
    </>
  );
  return (
    <>
      {canInspect && (
        <Box
          ref={surfaceRef}
          aria-label="Relever un point du scan"
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            cursor: "crosshair",
            touchAction: "none",
          }}
        />
      )}
      {host && createPortal(body, host)}
    </>
  );
}
