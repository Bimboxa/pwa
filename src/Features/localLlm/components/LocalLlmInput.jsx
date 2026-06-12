import { useState } from "react";
import { useSelector } from "react-redux";

import { Box } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useLocalLlmSend from "../hooks/useLocalLlmSend";

export default function LocalLlmInput() {
  // strings

  const sendS = "Envoyer";
  const placeholderS = "Posez votre question...";

  // state

  const [input, setInput] = useState("");

  // data

  const isStreaming = useSelector((s) => s.localLlm.isStreaming);
  const isMobile = useIsMobile();

  const sendToLlm = useLocalLlmSend();

  // handlers

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    await sendToLlm(text);
  }

  // render

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
      <FieldTextV2
        options={{ fullWidth: true, multiline: true, hideMic: isMobile }}
        variant="outlined"
        size="small"
        placeholder={placeholderS}
        value={input}
        onChange={setInput}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
      />

      <BoxAlignToRight>
        <ButtonGeneric
          variant="contained"
          color="secondary"
          startIcon={<SendIcon />}
          onClick={handleSend}
          disabled={!input || isStreaming}
          label={sendS}
        />
      </BoxAlignToRight>
    </Box>
  );
}
