import { useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import { Box, Button } from "@mui/material";

import PromptIaFlow from "./PromptIaFlow";

/**
 * « Prompt IA » entry of the Chat panel: the button opens the flow
 * (PromptIaFlow) for the selected listing as an overlay covering the
 * conversation. The overlay swallows the drops so the chat panel underneath
 * never takes the files.
 */
export default function ChatPromptIaButton({ disabled }) {
  // strings

  const buttonS = "Prompt IA";
  const closeS = "Retour à la discussion";

  // data

  const listingId = useSelector((s) => s.listings.selectedListingId);

  // state

  const [open, setOpen] = useState(false);

  // handlers

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // render

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {buttonS}
      </Button>
      {open && (
        <Box
          onDrop={handleDragOver}
          onDragOver={handleDragOver}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <PromptIaFlow
            listingId={listingId}
            onClose={() => setOpen(false)}
            closeLabel={closeS}
          />
        </Box>
      )}
    </>
  );
}

ChatPromptIaButton.propTypes = {
  disabled: PropTypes.bool,
};
