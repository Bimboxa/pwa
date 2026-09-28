import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { Stack } from "@mui/material";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import ChatPromptIaButton from "Features/promptIa/components/ChatPromptIaButton";

import { getVisibleListingTemplates } from "../utils/buildAutoDetectionContext";
import ChatAutoButton from "./ChatAutoButton";
import ChatRepairButton from "./ChatRepairButton";

// Row of detection entry points under the conversation: « Auto » (relay +
// model, needs the relay), « Réparation » (relay, deterministic repair of a
// zone) and « Prompt IA » (external AI chat, no relay).
export default function ChatActionsBar({ sendChatTurn, sending, showAuto }) {
  const baseMap = useMainBaseMap();
  const templates = useAnnotationTemplates();
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const chat = useSelector((s) => s.chat);
  const unavailable = sending || chat.isThinking || Boolean(chat.vectorization);
  const noTarget = !baseMap?.id || !selectedListingId;

  return (
    <Stack
      direction="row"
      sx={{ px: 2, pb: 1, flexWrap: "wrap", gap: 1, alignItems: "center" }}
    >
      {showAuto && (
        <ChatAutoButton
          send={sendChatTurn}
          disabled={unavailable || noTarget}
          hasVisibleTemplates={
            getVisibleListingTemplates(templates, selectedListingId).length > 0
          }
          hasPdfSource={baseMap?.createdFrom?.type === "PDF_PAGE"}
        />
      )}
      {showAuto && (
        <ChatRepairButton
          send={sendChatTurn}
          disabled={unavailable || noTarget}
        />
      )}
      <ChatPromptIaButton disabled={noTarget} />
    </Stack>
  );
}

ChatActionsBar.propTypes = {
  sendChatTurn: PropTypes.func,
  sending: PropTypes.bool,
  showAuto: PropTypes.bool,
};
