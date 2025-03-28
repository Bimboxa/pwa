import {useState} from "react";
import {useDispatch} from "react-redux";

import {sendMessage} from "../chatSlice";

import {Box, IconButton} from "@mui/material";
import {Send as SendIcon} from "@mui/icons-material";

import FieldText from "Features/form/components/FieldText";

export default function ChatInput() {
  const [input, setInput] = useState("");
  const dispatch = useDispatch();

  const handleSend = () => {
    if (!input.trim()) return;
    dispatch(sendMessage(input));
    setInput("");
  };
  return (
    <Box
      display="flex"
      p={1}
      gap={1}
      alignItems="center"
      borderTop="1px solid #ccc"
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
      <IconButton onClick={handleSend}>
        <SendIcon />
      </IconButton>
    </Box>
  );
}
