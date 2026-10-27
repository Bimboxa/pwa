/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Collapse,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import readLocalScanInWorker from "../services/readLocalScanInWorker";
import createLocalScanView from "../services/createLocalScanView";
import {
  deleteLocalScan,
  getLocalScan,
  getLocalScanSource,
  saveLocalScan,
  updateLocalScanPlacement,
} from "../services/localScanStore";

export default function LocalScansPanel({
  editor,
  contextKey,
  hidden = false,
  rightInset = 0,
  bottomInset = 0,
}) {
  // state
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(null);
  const [loaded, setLoaded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("POINTS");
  const [up, setUp] = useState("Z");
  const [scale, setScale] = useState("1");
  const [keepLocal, setKeepLocal] = useState(true);
  const [pointSize, setPointSize] = useState(2);
  const viewRef = useRef(null);
  const sourceRef = useRef(null);
  const abortRef = useRef(null);
  const epochRef = useRef(0);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    getLocalScan(contextKey).then(
      (row) => {
        if (alive) setSaved(row ?? null);
      },
      () => {
        if (alive)
          setError(
            "Le stockage local est indisponible. Vous pouvez ouvrir un scan sans l'enregistrer."
          );
      }
    );
    return () => {
      alive = false;
      epochRef.current++;
      abortRef.current?.abort();
      viewRef.current?.dispose();
      viewRef.current = null;
      sourceRef.current = null;
    };
  }, [contextKey, editor]);

  // handlers
  function closeScan() {
    epochRef.current++;
    abortRef.current?.abort();
    viewRef.current?.dispose();
    viewRef.current = null;
    sourceRef.current = null;
    setLoaded(null);
    setBusy(false);
    setMode("POINTS");
  }

  async function load(file, existing = null) {
    const epoch = ++epochRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setProgress(0);
    let nextView;
    try {
      const source = file ?? (await getLocalScanSource(contextKey));
      if (!source) throw new Error("Le fichier enregistré est introuvable.");
      if (epoch !== epochRef.current) return;
      const data = await readLocalScanInWorker(source, {
        signal: controller.signal,
        onProgress: setProgress,
      });
      if (epoch !== epochRef.current) return;
      const placement = {
        up: existing?.up ?? "Z",
        scale: existing?.scale ?? 1,
      };
      let persisted = Boolean(existing);
      if (!existing && keepLocal) {
        try {
          await saveLocalScan(contextKey, source, data, controller.signal);
          persisted = true;
          const row = await getLocalScan(contextKey);
          if (epoch === epochRef.current) setSaved(row);
        } catch {
          if (epoch === epochRef.current)
            setError(
              "Scan ouvert, mais non enregistré : espace local insuffisant ou stockage indisponible."
            );
        }
      }
      if (epoch !== epochRef.current) {
        return;
      }
      nextView = createLocalScanView(editor, data);
      nextView.setPlacement(placement);
      viewRef.current?.dispose();
      viewRef.current = nextView;
      sourceRef.current = source;
      setLoaded({
        name: source.name || existing?.name || "scan.ply",
        count: data.count,
        kind: data.kind,
        saved: persisted,
      });
      setMode("POINTS");
      setUp(placement.up);
      setScale(String(placement.scale));
      nextView.setPointSize(pointSize);
      await nextView.fit();
    } catch (failure) {
      if (viewRef.current !== nextView) nextView?.dispose();
      if (epoch === epochRef.current && failure.name !== "AbortError")
        setError(failure.message);
    } finally {
      if (epoch === epochRef.current) setBusy(false);
    }
  }

  async function changeMode(next) {
    if (!next || !viewRef.current || busy) return;
    const epoch = epochRef.current;
    setBusy(true);
    setError(null);
    try {
      await viewRef.current.setMode(next, sourceRef.current);
      if (epoch === epochRef.current) setMode(next);
    } catch (failure) {
      if (epoch === epochRef.current) {
        setError(`Rendu splats indisponible : ${failure.message}`);
        setMode("POINTS");
      }
    } finally {
      if (epoch === epochRef.current) setBusy(false);
    }
  }

  async function place(nextUp, nextScale) {
    const numeric = Number(nextScale);
    setUp(nextUp);
    setScale(nextScale);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 1000) return;
    viewRef.current?.setPlacement({ up: nextUp, scale: numeric });
    if (loaded?.saved) {
      try {
        await updateLocalScanPlacement(contextKey, {
          up: nextUp,
          scale: numeric,
        });
        setSaved((row) => (row ? { ...row, up: nextUp, scale: numeric } : row));
      } catch {
        setError("Le placement n'a pas pu être enregistré.");
      }
    }
  }

  async function removeSaved() {
    try {
      await deleteLocalScan(contextKey);
      setSaved(null);
      if (loaded) setLoaded({ ...loaded, saved: false });
    } catch {
      setError("Impossible d'effacer le fichier local.");
    }
  }

  // render
  return (
    <Card
      variant="outlined"
      sx={{
        display: hidden ? "none" : undefined,
        position: "absolute",
        bottom: 90 + bottomInset,
        right: 16 + rightInset,
        zIndex: 11,
        width: open ? 340 : "auto",
        maxWidth: "calc(100% - 32px)",
        maxHeight: "65%",
        overflow: "auto",
        p: 1,
      }}
    >
      <Button size="small" onClick={() => setOpen(!open)} aria-expanded={open}>
        Scans locaux {loaded ? "●" : ""}
      </Button>
      <Collapse in={open}>
        <Stack spacing={1} sx={{ p: 1 }}>
          <Typography variant="caption">
            Un scan local par dossier. Fichiers indépendants des exports et de
            la synchronisation du projet.
          </Typography>
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
          <Button
            variant="outlined"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            Ouvrir un PLY {saved ? "(remplacer)" : ""}
          </Button>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={keepLocal}
                onChange={(_, value) => setKeepLocal(value)}
                disabled={busy}
              />
            }
            label="Conserver sur cet appareil"
          />
          {saved && (
            <Box>
              <Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>
                Enregistré : {saved.name}
              </Typography>
              <Stack direction="row">
                <Button
                  size="small"
                  disabled={busy}
                  onClick={() => load(null, saved)}
                >
                  Rouvrir
                </Button>
                <Button size="small" disabled={busy} onClick={removeSaved}>
                  Effacer la copie locale
                </Button>
              </Stack>
            </Box>
          )}
          {busy && (
            <>
              <LinearProgress
                variant={progress < 1 ? "determinate" : "indeterminate"}
                value={progress * 100}
              />
              <Typography variant="caption">
                Lecture / préparation du scan…
              </Typography>
              <Button onClick={closeScan}>Annuler et fermer</Button>
            </>
          )}
          {error && (
            <Alert severity="warning" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {loaded && (
            <>
              <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                {loaded.name} · {loaded.count.toLocaleString("fr-FR")}{" "}
                {loaded.kind === "SPLAT" ? "gaussiennes" : "points"}
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={mode}
                onChange={(_, next) => changeMode(next)}
                disabled={busy}
              >
                <ToggleButton value="POINTS">Points</ToggleButton>
                <ToggleButton
                  value="SPLAT"
                  disabled={loaded.kind !== "SPLAT" || busy}
                >
                  Réaliste
                </ToggleButton>
              </ToggleButtonGroup>
              {loaded.kind === "SPLAT" && (
                <Typography variant="caption" color="text.secondary">
                  Le mode points montre les centres des gaussiennes, pas un
                  relevé laser.
                </Typography>
              )}
              <Stack direction="row" spacing={1}>
                <TextField
                  select
                  label="Axe vertical"
                  size="small"
                  value={up}
                  onChange={(e) => place(e.target.value, scale)}
                  disabled={busy}
                  sx={{ flex: 1 }}
                >
                  <MenuItem value="Z">Z</MenuItem>
                  <MenuItem value="Y">Y</MenuItem>
                </TextField>
                <TextField
                  label="Mètres / unité"
                  size="small"
                  type="number"
                  value={scale}
                  onChange={(e) => place(up, e.target.value)}
                  disabled={busy}
                  error={!(Number(scale) > 0 && Number(scale) <= 1000)}
                  sx={{ flex: 1 }}
                />
              </Stack>
              <Typography variant="caption">
                Échelle à confirmer avec une distance connue. Le scan est placé
                à son origine ; les outils de dessin existants restent
                indépendants.
              </Typography>
              {mode === "POINTS" && (
                <TextField
                  label="Taille des points (px)"
                  type="number"
                  size="small"
                  value={pointSize}
                  onChange={(e) => {
                    const size = Math.max(
                      1,
                      Math.min(10, Number(e.target.value) || 1)
                    );
                    setPointSize(size);
                    viewRef.current?.setPointSize(size);
                  }}
                />
              )}
              <Stack direction="row">
                <Button disabled={busy} onClick={() => viewRef.current?.fit()}>
                  Cadrer
                </Button>
                <Button onClick={closeScan}>Fermer le scan</Button>
              </Stack>
            </>
          )}
        </Stack>
      </Collapse>
    </Card>
  );
}
