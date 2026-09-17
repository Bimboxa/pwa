import { useEffect, useState } from "react";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useSendMessage from "../hooks/useSendMessage";
import useProcessAnswer from "../hooks/useProcessAnswer";
import useCallAgentDataManager from "../hooks/useCallAgentDataManager";
import useStartVectorization, {
  DEFAULT_VECTORIZATION_INSTRUCTION,
} from "../hooks/useStartVectorization";

import { Box } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldText from "Features/form/components/FieldText";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import ChatPendingPdf from "./ChatPendingPdf";

export default function ChatInput() {
  // strings

  const sendS = "Envoyer";

  // state

  const [input, setInput] = useState("");

  const isMobile = useIsMobile();

  const sendMessage = useSendMessage();
  const processAnswer = useProcessAnswer();
  const callAgentDataManager = useCallAgentDataManager();
  const {
    pendingPdf,
    hasActiveRun,
    clearPdf,
    setPageNumber,
    startVectorization,
  } = useStartVectorization();

  // A PDF was dropped: propose the default instruction (still editable).
  const pdfStatus = pendingPdf?.status;
  useEffect(() => {
    if (pdfStatus === "uploading") {
      setInput((current) => current || DEFAULT_VECTORIZATION_INSTRUCTION);
    }
  }, [pdfStatus]);

  const handleSend = async () => {
    if (pendingPdf) {
      if (pendingPdf.status !== "ready" || hasActiveRun) return;
      const { ok } = await startVectorization(input);
      if (ok) setInput("");
      return;
    }
    if (!input.trim()) return;
    //const answer = await sendMessage(input);
    const answer = await callAgentDataManager(input);

    // answer
    console.log("answer", answer);
    //processAnswer(answer);
    setInput("");
  };

  return (
    <Box
      display="flex"
      p={1}
      borderTop="1px solid #ccc"
      overflow="auto"
      flexDirection="column"
      sx={{ width: 1 }}
      gap={1}
    >
      <ChatPendingPdf
        pendingPdf={pendingPdf}
        onPageChange={setPageNumber}
        onClear={clearPdf}
      />
      <FieldTextV2
        options={{ fullWidth: true, multiline: true, hideMic: isMobile }}
        variant="outlined"
        size="small"
        placeholder="Type your question..."
        value={input}
        onChange={setInput}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />

      <BoxAlignToRight>
        <ButtonGeneric
          variant="contained"
          color="secondary"
          startIcon={<SendIcon />}
          onClick={handleSend}
          disabled={
            pendingPdf ? pendingPdf.status !== "ready" || hasActiveRun : !input
          }
          label={sendS}
        />
      </BoxAlignToRight>
    </Box>
  );
}
