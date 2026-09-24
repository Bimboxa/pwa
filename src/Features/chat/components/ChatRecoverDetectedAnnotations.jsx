import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { updateMessageAction } from "../chatSlice";
import { upsertAssistantRelayJobs } from "Features/assistantRelay/assistantRelaySlice";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import useApplyLiveDetectionJob from "Features/assistantRelay/hooks/useApplyLiveDetectionJob";
import {
  describeRelayError,
  fetchJob,
} from "Features/assistantRelay/services/assistantRelayClient";
import { recoverMessageDrawings } from "../utils/recoverChatDrawing";

export default function ChatRecoverDetectedAnnotations({ message }) {
  const dispatch = useDispatch();
  const { applyLiveJob } = useApplyLiveDetectionJob();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleRecover() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const results = await recoverMessageDrawings(message.actions, {
        fetchJob,
        applyLiveJob,
      });
      const errors = [];
      const applied = new Set();
      for (const result of results) {
        const error = result.failure
          ? result.failure.code
            ? describeRelayError(result.failure)
            : result.failure.message || "Récupération impossible. Réessayez."
          : result.error;
        dispatch(
          updateMessageAction({
            id: message.id,
            callId: result.action.callId,
            changes: {
              ...(result.liveStatus ? { liveStatus: result.liveStatus } : {}),
              recoveryError: error,
            },
          })
        );
        if (result.job) dispatch(upsertAssistantRelayJobs([result.job]));
        if (result.liveStatus === "applied") applied.add(result.action.jobId);
        if (error) errors.push(error);
      }
      setNotice({
        error: errors.length > 0,
        text: !results.length
          ? "Aucun dessin récupérable n’est référencé dans ce traitement. Les étapes d’analyse seules ne contiennent pas d’annotations à dessiner. Aucun calcul n’a été relancé."
          : [
              applied.size
                ? `${applied.size} dessin(s) appliqué(s) au plan ou déjà présent(s).`
                : null,
              ...new Set(errors),
            ]
              .filter(Boolean)
              .join(" "),
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Box sx={{ my: 1.5 }}>
      <Button
        variant="outlined"
        size="small"
        disabled={busy || Boolean(message.progress)}
        onClick={handleRecover}
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
      >
        {busy
          ? "Récupération et dessin en cours…"
          : "Rapatrier et dessiner les annotations détectées"}
      </Button>
      <Typography variant="caption" color="text.secondary" display="block">
        Récupère les dessins enregistrés sans relancer le calcul. Les dessins
        déjà appliqués ne sont pas importés à nouveau.
      </Typography>
      {notice ? (
        <Typography
          role={notice.error ? "alert" : "status"}
          variant="body2"
          color={notice.error ? "error" : "text.secondary"}
          sx={{ mt: 0.5 }}
        >
          {notice.text}
        </Typography>
      ) : null}
    </Box>
  );
}
