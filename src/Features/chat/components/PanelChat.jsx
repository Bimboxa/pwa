import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setIsThinking } from "../chatSlice";

import { Stack, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ChatInput from "./ChatInput";
import ChatMessage from "./ChatMessage";
import ThinkingBubble from "./ThinkingBubble";
import ChatHeader from "./ChatHeader";
import SectionManagedDataByAgent from "./SectionManagedDataByAgent";

export default function PanelChat() {
  const dispatch = useDispatch();

  const messages = useSelector((state) => state.chat.messages);
  const isThinking = useSelector((state) => state.chat.isThinking);

  const openChat = useSelector((s) => s.rightPanel.selectedMenuItemKey === "CHAT");

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
      <ChatHeader />
      <Stack spacing={2} sx={{ flex: 1, overflowY: "auto", p: 1 }}>
        {messages.map((msg, i) => (
          <ChatMessage key={i} role={msg.role} content={msg.content} />
        ))}
        {isThinking && <ThinkingBubble />}
        <SectionManagedDataByAgent />
      </Stack>

      {openChat && <ChatInput />}
    </Box>
  );
}
