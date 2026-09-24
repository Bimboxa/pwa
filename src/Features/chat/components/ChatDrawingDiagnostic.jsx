import { useRef, useState } from "react";
import { useStore } from "react-redux";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";
import { fetchJob } from "Features/assistantRelay/services/assistantRelayClient";
import {
  buildDrawingDiagnostic,
  drawingDiagnostics,
} from "Features/assistantRelay/utils/drawingDiagnostics";

export default function ChatDrawingDiagnostic({ jobId }) {
  const store = useStore();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [notice, setNotice] = useState("");
  async function collect() {
    if (inFlight.current) return;
    inFlight.current = true;
    setOpen(true);
    setBusy(true);
    setNotice("");
    setReport(null);
    // Capture local evidence before the read; this action never claims a job.
    const capturedAt = new Date().toISOString();
    const state = store.getState();
    const history = drawingDiagnostics.read(jobId);
    const environment = {
      visibility: document.visibilityState,
      online: navigator.onLine,
    };
    let serverJob;
    let fetchError;
    try {
      // A disconnected relay must not prevent exporting the local evidence.
      let timer;
      try {
        serverJob = await Promise.race([
          fetchJob(jobId),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject({ code: "DIAGNOSTIC_READ_TIMEOUT" }),
              8000
            );
          }),
        ]);
      } catch (error) {
        fetchError = error;
      } finally {
        clearTimeout(timer);
      }
      setReport(
        buildDrawingDiagnostic({
          jobId,
          state,
          serverJob,
          fetchError,
          history,
          environment,
          capturedAt,
        })
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  const json = report ? JSON.stringify(report, null, 2) : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setNotice("Diagnostic copié.");
    } catch {
      setNotice(
        "Copie impossible. Téléchargez le diagnostic ou sélectionnez le texte."
      );
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagnostic-dessin-${jobId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <Button
        size="small"
        color="inherit"
        disabled={busy}
        onClick={collect}
        aria-label="Ouvrir le diagnostic du dessin"
        sx={{ ml: "22px", my: 0.25 }}
      >
        Diagnostic du dessin
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Diagnostic du dessin</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Ce rapport permet de comprendre pourquoi le dessin n’a pas été
            appliqué. Il ne relance ni la détection ni le dessin.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            L’historique couvre cet onglet depuis son dernier chargement.
          </Typography>
          {busy ? (
            <Typography role="status">Lecture de l’état du dessin…</Typography>
          ) : null}
          {report?.serverRead.ok === false ? (
            <Typography role="status" color="warning.main">
              Serveur indisponible : les informations locales restent
              disponibles.
            </Typography>
          ) : null}
          {report ? (
            <Box
              component="pre"
              sx={{
                fontSize: 11,
                overflow: "auto",
                maxHeight: 360,
                userSelect: "text",
              }}
            >
              {json}
            </Box>
          ) : null}
          {notice ? (
            <Typography role="status" variant="caption">
              {notice}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button disabled={!report || busy} onClick={copy}>
            Copier
          </Button>
          <Button disabled={!report || busy} onClick={download}>
            Télécharger
          </Button>
          <Button onClick={() => setOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
