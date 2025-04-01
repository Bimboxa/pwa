import {useDispatch, useSelector} from "react-redux";

import useIsMobile from "Features/layout/hooks/useIsMobile";

import {setOpenChat} from "../layoutSlice";

import {Paper, IconButton, Box} from "@mui/material";
import {Close} from "@mui/icons-material";
import {Chat} from "@mui/icons-material";

import PanelChat from "Features/chat/components/PanelChat";

export default function PanelChatContainer() {
  const dispatch = useDispatch();

  // data

  const chatWidth = useSelector((s) => s.layout.chatWidth);
  const isMobile = useIsMobile();
  const open = useSelector((s) => s.layout.openChat);

  const width = isMobile ? "100%" : chatWidth;

  // handler

  function handleOpenChat() {
    dispatch(setOpenChat(true));
  }
  function handleCloseChat() {
    dispatch(setOpenChat(false));
  }

  return (
    <Paper
      square
      elevation={12}
      sx={{
        width,
        height: 1,
        position: "fixed",
        zIndex: 1000,
        top: 0,
        right: 0,
        transition: "transform 0.3s ease-in-out",
        transform: open ? "translateX(0)" : "translateX(100%)",
        display: "flex",
        flexDirection: "column",
        pb: isMobile ? 2 : 0,
      }}
    >
      {open && (
        <IconButton
          sx={{position: "absolute", top: 0, left: 0}}
          onClick={handleCloseChat}
        >
          <Close />
        </IconButton>
      )}
      {!open && !isMobile && (
        <IconButton
          color="primary"
          onClick={handleOpenChat}
          sx={{
            bgcolor: "primary.main",
            color: "common.white",
            "&:hover": {
              bgcolor: "primary.dark",
            },
            position: "absolute",
            top: "50%",
            left: "-50px",
            transform: "translateY(-50%)",
          }}
        >
          <Chat />
        </IconButton>
      )}
      <PanelChat />
    </Paper>
  );
}
