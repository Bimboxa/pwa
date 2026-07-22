import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setPovAiEnhanceEnabled } from "../povSlice";

import { Badge, Box, IconButton } from "@mui/material";
import { Edit as PromptIcon } from "@mui/icons-material";

import FieldCheck from "Features/form/components/FieldCheck";

import DialogPovEnhancePrompt from "./DialogPovEnhancePrompt";

import usePovEnhancePrompt from "../hooks/usePovEnhancePrompt";

// "Amélioration IA" toggle (Image tab, under the description): the next
// "Créer une vue" / "Mettre à jour la vue" also sends the capture to the
// image-transformation endpoint. The icon button shows the prompt used
// (usedByPov item of the org's imageTransformationPrompts).
export default function SectionPovAiEnhance() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Amélioration IA";
  const promptTitleS = "Modifier le prompt d'amélioration IA";

  // data

  const aiEnhanceEnabled = useSelector((s) => s.pov.aiEnhanceEnabled);
  const { isCustom, enabled } = usePovEnhancePrompt();

  // state

  const [openPrompt, setOpenPrompt] = useState(false);

  // handlers

  function handleToggle(checked) {
    dispatch(setPovAiEnhanceEnabled(Boolean(checked)));
  }

  // render

  if (!enabled) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <FieldCheck
        value={aiEnhanceEnabled}
        onChange={handleToggle}
        label={labelS}
        options={{ type: "switch", showAsInline: true }}
      />
      <IconButton
        size="small"
        onClick={() => setOpenPrompt(true)}
        title={promptTitleS}
      >
        <Badge color="secondary" variant="dot" invisible={!isCustom}>
          <PromptIcon fontSize="small" />
        </Badge>
      </IconButton>

      <DialogPovEnhancePrompt
        open={openPrompt}
        onClose={() => setOpenPrompt(false)}
      />
    </Box>
  );
}
