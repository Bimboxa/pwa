import { useState } from "react";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useSendMessage from "../hooks/useSendMessage";
import useProcessAnswer from "../hooks/useProcessAnswer";
import useCallAgentDataManager from "../hooks/useCallAgentDataManager";

import { Box } from "@mui/material";
import { Send as SendIcon } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldText from "Features/form/components/FieldText";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import FieldTextV2 from "Features/form/components/FieldTextV2";

export default function ChatInput() {

  // strings

  const sendS = "Envoyer";

  // state

  const [input, setInput] = useState("");

  const isMobile = useIsMobile();

  const sendMessage = useSendMessage();
  const processAnswer = useProcessAnswer();
  const callAgentDataManager = useCallAgentDataManager();

  const handleSend = async () => {
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
          disabled={!input}
          label={sendS} />
      </BoxAlignToRight>

    </Box>
  );
}
