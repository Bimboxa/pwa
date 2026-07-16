import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setPovAiEnhanceEnabled } from "../povSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { Notes as PromptIcon } from "@mui/icons-material";

import FieldCheck from "Features/form/components/FieldCheck";
import DialogGeneric from "Features/layout/components/DialogGeneric";

import usePovEnhancePrompt from "../hooks/usePovEnhancePrompt";

// "Amélioration IA" toggle (Image tab, under the description): the next
// "Créer une vue" also sends the capture to the image-transformation
// endpoint. The icon button shows the prompt used (usedByPov item of the
// org's imageTransformationPrompts).
export default function SectionPovAiEnhance() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Amélioration IA";
  const promptTitleS = "Prompt utilisé";

  // data

  const aiEnhanceEnabled = useSelector((s) => s.pov.aiEnhanceEnabled);
  const { prompt, enabled } = usePovEnhancePrompt();

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
        <PromptIcon fontSize="small" />
      </IconButton>

      <DialogGeneric
        open={openPrompt}
        onClose={() => setOpenPrompt(false)}
        title={promptTitleS}
        width={520}
      >
        <Box sx={{ p: 2, overflowY: "auto" }}>
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {prompt?.prompt}
          </Typography>
        </Box>
      </DialogGeneric>
    </Box>
  );
}
