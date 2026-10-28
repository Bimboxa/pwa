/* eslint-disable react/prop-types */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import { toggleScene3dHiddenIn3d } from "Features/threedEditor/threedEditorSlice";
import { setBaseMapsScanMode } from "Features/viewers/viewersSlice";
import useToggleModuleEditor from "Features/viewers/hooks/useToggleModuleEditor";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import Scan3dHeader from "./Scan3dHeader";
import SectionScanDisplay from "./SectionScanDisplay";
import SectionScanSlice from "./SectionScanSlice";
import SectionScanCalibration from "./SectionScanCalibration";
import ButtonUpdateScanBaseMap from "./ButtonUpdateScanBaseMap";
import DialogLocalScanZone from "./DialogLocalScanZone";
import useScanProjection from "../hooks/useScanProjection";
import readLocalScanInWorker from "../services/readLocalScanInWorker";
import createLocalScanView from "../services/createLocalScanView";
import localScanRuntime from "../services/localScanRuntime";
import resources from "../services/scanResources";
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

// Source vertical axis of a placement (origin shifts along it move the
// scan along world Y: root.position = −scale · R · origin).
const upVector = (up) => (up === "Y" ? [0, 1, 0] : [0, 0, 1]);

// Scan 3D tool: edits the base map projected from a local point cloud that
// is SELECTED (main base map): its scan is opened at the base map pose and
// follows the later moves of the map; the sections set the display, the
// slice / projected image and the calibration; « Mettre à jour le fond de
// plan » writes the image, the pose and the height map. Base maps are
// created from the « Scène 3D » card of the Fonds de plan creation
// (DialogCreateBaseMapFromScene3d), never here.
// inactive: the 2D view is displayed — the scan stays loaded (and placed)
// but projection and overlays pause until the 3D comes back.
export default function LocalScansPanel({
  editor,
  projectId,
  hidden = false,
  inactive = false,
}) {
  // strings
  const noBaseMapS =
    "Sélectionnez un fond de plan créé depuis un scan 3D (nuage de points) pour le modifier ici.";
  const scanMissingS =
    "Le scan de ce fond de plan n’est plus dans les ressources du projet.";

  // data
  const dispatch = useDispatch();
  const axesYaw = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
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
  // « 3D » chips of the base maps list (hidden scans).
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
  const [pointSize, setPointSize] = useState(2);
  // « Voir en 3D »: the coloured points near the two cut planes.
  const [boundsIn3d, setBoundsIn3d] = useState(true);
  // Vertical offset of the scan relative to the pose stored on the base
  // map (0 at each pose application; saved by « Mettre à jour »).
  const [offsetZ, setOffsetZ] = useState(0);
  // The panel eye IS the « 3D » chip of the selected base map.
  const linkedId =
    linkedBaseMap &&
    view &&
    loaded?.resourceId === linkedBaseMap.localScan.resourceId
      ? linkedBaseMap.id
      : null;
  const modelVisible = linkedId
    ? !(hiddenScanIds ?? []).includes(linkedId)
    : true;
  // Mode the view should render: Réaliste needs Gaussian data.
  const wantedMode =
    loaded?.kind === "SPLAT" && scanMode === "SPLAT" ? "SPLAT" : "POINTS";
  const failedSplatRef = useRef(null);
  const [zoneRequest, setZoneRequest] = useState(null);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(null);
  const abortRef = useRef(null),
    epochRef = useRef(0),
    // Source file of the opened scan (the realistic decode reads it).
    sourceRef = useRef(null),
    // Reference on the shared decoded scan (localScanRuntime).
    scanHandleRef = useRef(null);
  const projection = useScanProjection({
    editor,
    view,
    axesYaw,
    placementKey: JSON.stringify(placement),
    active: Boolean(view) && !paused,
    inspect: false,
    hidden: paused || busy,
    showBounds: Boolean(
      host && !busy && !inactive && modelVisible && boundsIn3d
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
  // pose (so it follows the 2D / 3D moves of the map), slice of its image.
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
    // Last base map pose applied to the tool: a pending calibration
    // (« Mettre à jour » not clicked yet) survives mode changes and 2D / 3D
    // switches.
    poseAppliedRef = useRef(null),
    rangeAppliedRef = useRef(null);
  useEffect(() => {
    if (!linkedBaseMap) linkTriedRef.current = null;
  }, [linkedBaseMap]);
  // No scan base map selected any more: the scan leaves the tool.
  useEffect(() => {
    if (linkedBaseMap || (!view && !busy)) return;
    closeScan();
  }, [linkedBaseMap, view, busy]);
  useEffect(() => {
    if (!linkedBaseMap || inactive || busy) return;
    const { resourceId } = linkedBaseMap.localScan;
    if (view && loaded?.resourceId === resourceId) {
      if (poseAppliedRef.current === linkPoseKey) return;
      poseAppliedRef.current = linkPoseKey;
      setOffsetZ(0);
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
      if (row && !row.deletedAt) void load(row, { link: linkedBaseMap });
      else setError(scanMissingS);
    });
    // placement / load are read at the pose or selection change only.
  }, [linkPoseKey, loaded?.resourceId, view, inactive, busy]);
  // Slice of the base map image, applied once per opened scan (a later
  // frame change — Z offset, axis, scale — keeps or resets the slice in the
  // projection hook, never re-applies the stored one).
  useEffect(() => {
    if (!linked || !projection.frame) return;
    const key = linked.id;
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

  // handlers
  function closeScan() {
    epochRef.current++;
    abortRef.current?.abort();
    viewRef.current?.dispose();
    viewRef.current = null;
    scanHandleRef.current?.release();
    scanHandleRef.current = null;
    sourceRef.current = null;
    setView(null);
    setLoaded(null);
    setBusy(false);
    setOffsetZ(0);
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
  // Opens the scan of a resource. link: the selected scan base map (the
  // scan is placed at the base map pose). editZone: the zone dialog first,
  // then the resource zone is replaced (the pose of the base map is kept).
  async function load(resource, { editZone = false, link = null } = {}) {
    const epoch = ++epochRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(0);
    setError(null);
    let nextView,
      handle = null;
    try {
      const source = await resources.source(resource);
      if (!source)
        throw new Error(
          "Le fichier de cette ressource est absent de cet appareil. Rechargez-le depuis Ressources."
        );
      if (epoch !== epochRef.current) return;
      const savedZone = resource.scan?.zone;
      let zone = savedZone,
        zoneChosen = null;
      if (editZone) {
        zoneChosen = await requestZone(source, savedZone, controller.signal);
        zone = zoneChosen.zone;
      }
      if (epoch !== epochRef.current) return;
      // A saved scan reopened as is may already be decoded for its base
      // map: share it.
      let data;
      if (!zoneChosen) {
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
        ...resource.scan?.placement,
        ...(zoneChosen &&
          getScanZonePlacement(zone, axesYaw, zoneChosen.wholePolygon)),
      };
      if (link)
        Object.assign(
          nextPlacement,
          getLinkedPlacement(link, nextPlacement.up)
        );
      if (zoneChosen) {
        try {
          await resources.update(resource.id, {
            zone,
            placement: nextPlacement,
            count: data.count,
            bounds: data.bounds,
          });
        } catch {
          setError("La zone n’a pas pu être enregistrée dans la ressource.");
        }
        if (epoch !== epochRef.current) return;
        handle = localScanRuntime.seed(
          { id: resource.id, scan: { zone } },
          { data, source }
        );
        ({ data } = await handle.promise);
      }
      const display = { ...DEFAULT_DISPLAY, ...resource.scan?.display };
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
        resourceId: resource.id,
      });
      setMode("POINTS");
      setPointSize(display.pointSize);
      setOffsetZ(0);
      rangeAppliedRef.current = null;
      // No camera move: the scan is already in place on its base map (the
      // « Cadrer » menu item frames it on demand).
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
    if (busy || !loaded?.resourceId) return;
    const row = await resources.get(loaded.resourceId);
    if (row && !row.deletedAt)
      await load(row, { editZone: true, link: linked });
    else setError(scanMissingS);
  }
  // Calibration: the base map owns the pose (saved by « Mettre à jour »);
  // the axis and the scale of the resource are kept up to date so a base
  // map created later from the same scan starts calibrated.
  async function place(patch) {
    const next = { ...placement, ...patch };
    if (!Number.isFinite(next.scale) || next.scale <= 0 || next.scale > 1000)
      return;
    view?.setPlacement(next);
    setPlacement(next);
    if (loaded?.resourceId && ("up" in patch || "scale" in patch)) {
      try {
        await resources.place(loaded.resourceId, next);
      } catch {
        setError("Le placement n’a pas pu être enregistré dans la ressource.");
      }
    }
  }
  function changeOffsetZ(value) {
    const delta = value - offsetZ;
    if (!delta) return;
    const axis = upVector(placement.up);
    const origin = placement.origin ?? [0, 0, 0];
    setOffsetZ(value);
    // the slice (Z inf / Z sup) moves with the points
    projection.shiftRange(delta);
    void place({
      origin: origin.map((v, i) => v - (delta / placement.scale) * axis[i]),
    });
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
  }
  function changePointSize(size) {
    setPointSize(size);
    view.setPointSize(size);
    void saveDisplay({ pointSize: size });
  }
  async function download(imageMode) {
    if (!projection.current) return;
    try {
      const file = await sliceImageFile(
        projection.result,
        imageMode,
        `scan-${imageMode}.png`
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
  const body = (
    <>
      <Scan3dHeader
        model={loaded}
        baseMapName={linkedBaseMap?.name}
        busy={busy}
        onFrame={() => view?.fit()}
        onEditZone={loaded ? () => void editZone() : undefined}
      />
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
            <Button onClick={closeScan}>Annuler</Button>
          </>
        )}
        {!linkedBaseMap && !busy && <Alert severity="info">{noBaseMapS}</Alert>}
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
            <SectionScanDisplay
              loaded={loaded}
              mode={wantedMode}
              pointSize={pointSize}
              modelVisible={modelVisible}
              onToggleVisible={toggleVisible}
              onChangeMode={(value) => {
                if (value) dispatch(setBaseMapsScanMode(value));
              }}
              onChangePointSize={changePointSize}
            />
            <SectionScanSlice
              projection={projection}
              onDownload={download}
              boundsIn3d={boundsIn3d}
              onBoundsIn3dChange={setBoundsIn3d}
            />
            <SectionScanCalibration
              placement={placement}
              offsetZ={offsetZ}
              onPlace={(patch) => void place(patch)}
              onOffsetZChange={changeOffsetZ}
            />
          </>
        )}
      </Stack>
      {loaded && !inactive && (
        <Box
          sx={{
            p: 1.5,
            flexShrink: 0,
            borderTop: 1,
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <ButtonUpdateScanBaseMap
            projection={projection}
            view={view}
            linkedBaseMap={linked}
            disabled={busy}
          />
        </Box>
      )}
      {zoneRequest && (
        <DialogLocalScanZone
          file={zoneRequest.file}
          initialZone={zoneRequest.initialZone}
          onConfirm={zoneRequest.onConfirm}
          onCancel={zoneRequest.onCancel}
        />
      )}
    </>
  );
  return host ? createPortal(body, host) : null;
}
