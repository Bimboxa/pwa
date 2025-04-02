import {useState} from "react";

import {Box, IconButton} from "@mui/material";
import {Send as SendIcon} from "@mui/icons-material";

import FieldText from "Features/form/components/FieldText";
import useSendMessage from "../hooks/useSendMessage";
import useProcessAnswer from "../hooks/useProcessAnswer";

export default function ChatInput() {
  const [input, setInput] = useState("");

  const sendMessage = useSendMessage();
  const processAnswer = useProcessAnswer();

  const handleSend = async () => {
    if (!input.trim()) return;
    const answer = await sendMessage(input);

    // answer
    console.log("answer", answer);
    processAnswer(answer);
    setInput("");
  };

  return (
    <Box
      display="flex"
      p={1}
      gap={1}
      alignItems="center"
      borderTop="1px solid #ccc"
      overflow="auto"
    >
      <FieldText
        options={{fullWidth: true, multiline: true}}
        variant="outlined"
        size="small"
        placeholder="Type your question..."
        value={input}
        onChange={setInput}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
      />
      <IconButton onClick={handleSend} disabled={!input}>
        <SendIcon />
      </IconButton>
    </Box>
  );
}
