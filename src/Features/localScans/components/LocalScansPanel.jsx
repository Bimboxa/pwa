/* eslint-disable react/prop-types */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { setScan3dTab } from "Features/rightPanel/rightPanelSlice";
import { Vector3 } from "three";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import LocalScanSliceSection from "./LocalScanSliceSection";
import ScanProjectionPreview from "./ScanProjectionPreview";
import ButtonCreateScanBaseMap from "./ButtonCreateScanBaseMap";
import useScanProjection from "../hooks/useScanProjection";
import inspectLocalScan from "../services/inspectLocalScan";
import readLocalScanInWorker from "../services/readLocalScanInWorker";
import createLocalScanView from "../services/createLocalScanView";
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

const DEFAULT_PLACEMENT = { up: "Z", scale: 1, origin: [0, 0, 0], yaw: 0 };

export default function LocalScansPanel({ editor, projectId, hidden = false }) {
  // data
  const dispatch = useDispatch();
  const axesYaw = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
  const tab = useSelector((s) => s.rightPanel.scan3dTab) ?? "GENERAL";
  const host = useSyncExternalStore(subscribeScanPanelHost, getScanPanelHost);

  // state
  const [view, setView] = useState(null),
    viewRef = useRef(null);
  const [loaded, setLoaded] = useState(null);
  const [placement, setPlacement] = useState(DEFAULT_PLACEMENT);
  const [mode, setMode] = useState("POINTS");
  const [pointSize, setPointSize] = useState(2);
  const [inspection, setInspection] = useState(false);
  const [picked, setPicked] = useState(null),
    [pickMessage, setPickMessage] = useState(null);
  const [projectionActive, setProjectionActive] = useState(false);
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(null);
  const [picker, setPicker] = useState(false),
    [available, setAvailable] = useState([]);
  const inputRef = useRef(null),
    sourceRef = useRef(null),
    surfaceRef = useRef(null);
  const abortRef = useRef(null),
    epochRef = useRef(0);
  const canInspect = Boolean(
    inspection && tab === "POSITION" && host && view && !busy && !hidden
  );
  const projection = useScanProjection({
    editor,
    view,
    axesYaw,
    placementKey: JSON.stringify(placement),
    active: projectionActive,
    inspect: canInspect,
    hidden: hidden || busy,
    showBounds: Boolean(host && tab === "PROJECTION" && !busy),
  });

  // helpers
  useEffect(
    () => () => {
      epochRef.current++;
      abortRef.current?.abort();
      viewRef.current?.dispose();
      viewRef.current = null;
      sourceRef.current = null;
    },
    [editor, projectId]
  );
  useEffect(() => {
    if (tab === "PROJECTION" && view) setProjectionActive(true);
  }, [tab, view]);
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
  async function load(file, resource = null) {
    const epoch = ++epochRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPicker(false);
    setBusy(true);
    setProgress(0);
    setError(null);
    let nextView;
    try {
      const source = file ?? (await getAvailableScanSource(resource));
      if (!source)
        throw new Error(
          "Le fichier de cette ressource est absent de cet appareil. Rechargez-le depuis Ressources."
        );
      if (epoch !== epochRef.current) return;
      const data = await readLocalScanInWorker(source, {
        signal: controller.signal,
        onProgress: setProgress,
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
      };
      let saved = resource && !resource.legacy ? resource : null;
      if (!saved) {
        try {
          saved = await resources.save({
            projectId,
            file: source,
            data,
            placement: nextPlacement,
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
      nextView = createLocalScanView(editor, data);
      nextView.setPlacement(nextPlacement);
      nextView.setPointSize(pointSize);
      viewRef.current?.dispose();
      viewRef.current = nextView;
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
      if (epoch === epochRef.current) setBusy(false);
    }
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
    if (loaded?.resourceId) {
      try {
        await resources.place(loaded.resourceId, next);
      } catch {
        setError("Le placement n’a pas pu être enregistré dans la ressource.");
      }
    }
  }
  async function changeMode(next) {
    if (!next || !view || busy) return;
    const epoch = epochRef.current;
    setBusy(true);
    setError(null);
    try {
      await view.setMode(next, sourceRef.current);
      if (epoch === epochRef.current) setMode(next);
    } catch (failure) {
      if (epoch === epochRef.current) {
        setError(`Rendu réaliste indisponible : ${failure.message}`);
        setMode("POINTS");
      }
    } finally {
      if (epoch === epochRef.current) setBusy(false);
    }
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
      {loaded && (
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
              value={progress}
            />
            <Typography variant="caption">Préparation du modèle…</Typography>
            <Button onClick={closeScan}>Annuler et fermer</Button>
          </>
        )}
        {!loaded && !busy && (
          <WhiteSectionGeneric>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => setPicker(true)}
            >
              Charger un modèle 3D…
            </Button>
          </WhiteSectionGeneric>
        )}
        {loaded && !busy && (
          <>
            {tab === "GENERAL" && (
              <>
                <WhiteSectionGeneric>
                  <Stack spacing={1}>
                    <Typography
                      variant="subtitle2"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {loaded.name}
                    </Typography>
                    <Typography variant="caption">
                      {loaded.count.toLocaleString("fr-FR")}{" "}
                      {loaded.kind === "SPLAT" ? "gaussiennes" : "points"} ·{" "}
                      {stringifyFileSize(loaded.size)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {loaded.resourceId
                        ? "Enregistré comme ressource locale du projet."
                        : "Ouvert temporairement sur cet appareil."}
                    </Typography>
                    {!loaded.resourceId && (
                      <Button onClick={saveCurrent}>
                        Enregistrer dans les ressources du projet
                      </Button>
                    )}
                  </Stack>
                </WhiteSectionGeneric>
                <WhiteSectionGeneric>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      Affichage du modèle
                    </Typography>
                    <ToggleButtonGroup
                      size="small"
                      exclusive
                      value={mode}
                      onChange={(_, value) => void changeMode(value)}
                    >
                      <ToggleButton value="POINTS">Points</ToggleButton>
                      <ToggleButton
                        value="SPLAT"
                        disabled={loaded.kind !== "SPLAT"}
                      >
                        Réaliste
                      </ToggleButton>
                    </ToggleButtonGroup>
                    {mode === "POINTS" && (
                      <TextField
                        label="Taille des points (px)"
                        type="number"
                        size="small"
                        value={pointSize}
                        onChange={(event) => {
                          const size = Math.max(
                            1,
                            Math.min(12, Number(event.target.value) || 1)
                          );
                          setPointSize(size);
                          view.setPointSize(size);
                        }}
                      />
                    )}
                    {loaded.kind === "SPLAT" && (
                      <Typography variant="caption" color="text.secondary">
                        Les points sont les centres des gaussiennes, pas un
                        relevé laser.
                      </Typography>
                    )}
                  </Stack>
                </WhiteSectionGeneric>
                <WhiteSectionGeneric>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Image projetée</Typography>
                    <ScanProjectionPreview projection={projection} />
                    {projection.result && (
                      <ButtonCreateScanBaseMap
                        projection={projection}
                        modelName={loaded.name}
                        resourceId={loaded.resourceId}
                      />
                    )}
                  </Stack>
                </WhiteSectionGeneric>
                <WhiteSectionGeneric>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      Actions du modèle
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button onClick={() => view.fit()}>
                        Cadrer le modèle
                      </Button>
                      <Button onClick={() => setPicker(true)}>
                        Charger un autre modèle
                      </Button>
                    </Stack>
                    <Button color="inherit" onClick={closeScan}>
                      Fermer le modèle
                    </Button>
                  </Stack>
                </WhiteSectionGeneric>
              </>
            )}
            {tab === "PROJECTION" && (
              <LocalScanSliceSection
                projection={projection}
                onDownload={download}
              />
            )}
            {tab === "POSITION" && (
              <>
                <WhiteSectionGeneric>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      Placement du modèle
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <TextField
                        select
                        size="small"
                        label="Axe vertical"
                        value={placement.up}
                        onChange={(event) =>
                          void place({ up: event.target.value })
                        }
                        sx={{ flex: 1 }}
                      >
                        <MenuItem value="Z">Z</MenuItem>
                        <MenuItem value="Y">Y</MenuItem>
                      </TextField>
                      <TextField
                        key={placement.scale}
                        type="number"
                        size="small"
                        label="Mètres / unité"
                        defaultValue={placement.scale}
                        onBlur={(event) =>
                          void place({ scale: Number(event.target.value) })
                        }
                        slotProps={{
                          htmlInput: { min: 0.000001, max: 1000, step: 0.01 },
                        }}
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Échelle à confirmer avec une distance connue.
                    </Typography>
                  </Stack>
                </WhiteSectionGeneric>
                <WhiteSectionGeneric>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">
                      Point de référence
                    </Typography>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={inspection}
                          onChange={(_, value) => {
                            setInspection(value);
                            setPicked(null);
                            setPickMessage(null);
                          }}
                        />
                      }
                      label="Coordonnées au clic"
                    />
                    {inspection && (
                      <Typography variant="caption">
                        Cliquez sur le modèle pour relever un point. Glissez
                        pour naviguer. Plan recherché dans un cube de 1 m ;
                        grille temporaire de 2 × 2 m.
                      </Typography>
                    )}
                    {pickMessage && (
                      <Typography variant="caption">{pickMessage}</Typography>
                    )}
                    {picked && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ flex: 1 }}>
                          {coordinates.map(({ key, value }) => (
                            <Typography key={key} variant="body2">
                              {key} :{" "}
                              {Math.abs(value) < 0.0005
                                ? "0,000"
                                : value.toLocaleString("fr-FR", {
                                    minimumFractionDigits: 3,
                                    maximumFractionDigits: 3,
                                  })}{" "}
                              m
                            </Typography>
                          ))}
                        </Box>
                        <Button
                          onClick={() => {
                            setInspection(false);
                            void place({ origin: picked.point });
                          }}
                        >
                          Mettre à l’origine
                        </Button>
                      </Stack>
                    )}
                    {picked && (
                      <Typography variant="caption" color="text.secondary">
                        {picked.neighbourCount?.toLocaleString("fr-FR")} points
                        dans le cube.{" "}
                        {picked.normal
                          ? `Plan soutenu par ${Math.round(picked.support * 100)} % des points analysés.`
                          : "Centre du point ; aucun plan fiable."}
                      </Typography>
                    )}
                  </Stack>
                </WhiteSectionGeneric>
                <WhiteSectionGeneric>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Axe X du modèle</Typography>
                    <ScanProjectionPreview
                      projection={projection}
                      onRotate={rotate}
                    />
                    <Typography variant="caption">
                      Rotation : {placement.yaw.toFixed(1)}°. L’axe choisi dans
                      l’image fait pivoter le modèle 3D autour de son origine.
                    </Typography>
                    <Button
                      disabled={placement.yaw === 0}
                      onClick={() => {
                        setInspection(false);
                        void place({ yaw: 0 });
                      }}
                    >
                      Réinitialiser la rotation
                    </Button>
                  </Stack>
                </WhiteSectionGeneric>
              </>
            )}
          </>
        )}
      </Stack>
      <Dialog
        open={picker}
        onClose={() => setPicker(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Charger un modèle 3D</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              onClick={() => inputRef.current?.click()}
            >
              Choisir un fichier PLY sur cet appareil
            </Button>
            <Typography variant="caption" color="text.secondary">
              Le fichier sera enregistré dans les ressources du projet.
            </Typography>
            {available.length > 0 && (
              <>
                <Typography variant="subtitle2">
                  Modèles locaux du projet
                </Typography>
                <List>
                  {available.map((row) => (
                    <ListItemButton
                      key={row.id}
                      onClick={() => void load(null, row)}
                    >
                      <ListItemText
                        primary={row.name}
                        secondary={stringifyFileSize(row.fileSize ?? row.size)}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPicker(false)}>Annuler</Button>
        </DialogActions>
      </Dialog>
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
