import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import applyChatSessionContext from "../utils/applyChatSessionContext";
import {
  Box,
  Button,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import NavigationIcon from "@mui/icons-material/Navigation";

export default function ChatSessionNavigation() {
  const dispatch = useDispatch();
  const context = useSelector((s) => s.chat.conversation.navigationContext);
  const sessionId = useSelector((s) => s.chat.sessionId);
  const [anchorEl, setAnchorEl] = useState(null);
  const menuId = `chat-navigation-${sessionId}`;

  function applyContext() {
    applyChatSessionContext(dispatch, context);
    setAnchorEl(null);
  }

  return (
    <>
      <Tooltip title="Navigation">
        <IconButton
          size="small"
          aria-label="Navigation"
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchorEl)}
          aria-controls={anchorEl ? menuId : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
        >
          <NavigationIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Popover
        id={menuId}
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Box
          role="dialog"
          aria-label="Contexte de la session"
          sx={{
            p: 2,
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            boxSizing: "border-box",
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Contexte de la session
          </Typography>
          {context ? (
            [
              ["Projet", context.projectName, context.projectId],
              ["Scope", context.scopeName, context.scopeId],
              ["Fond de plan", context.baseMapName, context.baseMapId],
            ].map(([label, name, id]) => (
              <Box key={label} sx={{ mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
                  {name || id || "Non sélectionné"}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Le contexte sera enregistré au premier message.
            </Typography>
          )}
          <Button
            fullWidth
            variant="outlined"
            size="small"
            disabled={!context}
            onClick={applyContext}
          >
            Appliquer le contexte de la session
          </Button>
        </Box>
      </Popover>
    </>
  );
}
