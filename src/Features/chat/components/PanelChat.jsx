import {useEffect} from "react";
import {useSelector, useDispatch} from "react-redux";

import {setIsThinking} from "../chatSlice";

import {Stack, Box} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import ThinkingBubble from "./ThinkingBubble";

export default function PanelChat() {
  const dispatch = useDispatch();

  const messages = useSelector((state) => state.chat.messages);
  const isThinking = useSelector((state) => state.chat.isThinking);

  const openChat = useSelector((s) => s.layout.openChat);

  useEffect(() => {
    if (!openChat) {
      dispatch(setIsThinking(false));
    }
  }, [openChat]);

  return (
    <Box
      sx={{
        height: 1,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid #ccc",
        width: 1,
        backgroundColor: "#f9f9f9",
      }}
    >
      <Stack spacing={2} sx={{flex: 1, overflowY: "auto", p: 2}}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {isThinking && <ThinkingBubble />}
      </Stack>

      {openChat && <ChatInput />}
    </Box>
  );
}
