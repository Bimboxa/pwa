import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { updateMessageAction } from "../chatSlice";
import { upsertAssistantRelayJobs } from "Features/assistantRelay/assistantRelaySlice";
import { Button, CircularProgress } from "@mui/material";
import useApplyLiveDetectionJob from "Features/assistantRelay/hooks/useApplyLiveDetectionJob";
import {
  describeRelayError,
  fetchJob,
} from "Features/assistantRelay/services/assistantRelayClient";
import { recoverChatDrawing } from "../utils/recoverChatDrawing";

export default function ChatRecoverDrawing({ messageId, action }) {
  const dispatch = useDispatch();
  const { applyLiveJob } = useApplyLiveDetectionJob();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  async function handleRecover() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const update = (changes) =>
      dispatch(
        updateMessageAction({
          id: messageId,
          callId: action.callId,
          changes,
        })
      );
    update({ recoveryError: null });
    try {
      const result = await recoverChatDrawing(action.jobId, {
        fetchJob,
        applyLiveJob,
      });
      update({ liveStatus: result.liveStatus, recoveryError: result.error });
      dispatch(upsertAssistantRelayJobs([result.job]));
    } catch (error) {
      update({
        recoveryError: error?.code
          ? describeRelayError(error)
          : error?.message || "Récupération impossible. Réessayez.",
      });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outlined"
      size="small"
      disabled={busy}
      onClick={handleRecover}
      startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
      sx={{ ml: "22px", my: 0.75 }}
    >
      {busy ? "Dessin en cours…" : "Dessiner"}
    </Button>
  );
}
