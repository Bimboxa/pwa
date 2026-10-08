import PropTypes from "prop-types";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";

import useListingById from "Features/listings/hooks/useListingById";
import DialogGeneric from "Features/layout/components/DialogGeneric";

import PromptIaFlow from "./PromptIaFlow";

/**
 * Prompt IA dialog opened by the play button of the virtual "Prompt IA"
 * procedure of the "Dessin auto" band (SectionListingProcedures): the flow
 * (context → zip → result) for the band's listing, its description
 * pre-filled with the listing's Prompt IA instructions, the mode locked to
 * the detection from the listing's templates, in two steps (prompt zip →
 * result). The zip is built from the displayed base map (`baseMapId` = the
 * band's base map).
 */
export default function DialogPromptIa({ open, onClose, listingId }) {
  const dispatch = useDispatch();

  // strings

  const captionS = "Dessin auto";
  const titleS = "Prompt IA";
  const closeS = "Fermer";

  // data

  const listing = useListingById(listingId);

  // handlers

  // The dialog closes on creation: the "Dessin auto" band then offers the
  // sweep of the created annotations (getPromptIaOutputs).
  function handleCreated(result) {
    const count = result?.placedIds?.length ?? 0;
    dispatch(
      setToaster({
        message: `${count} annotation(s) créée(s) par le Prompt IA`,
      })
    );
    onClose?.();
  }

  // render

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      width={560}
      title={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.4,
              }}
            >
              {captionS}
            </Typography>
            <Typography variant="h6" noWrap sx={{ fontWeight: "bold" }}>
              {titleS}
            </Typography>
          </Box>
          <Tooltip title={closeS}>
            <IconButton size="small" onClick={onClose}>
              <Close fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      {/* the listing row drives the initial description: wait for it */}
      {listing !== undefined && (
        <PromptIaFlow
          listingId={listingId}
          initialDescription={listing?.promptIaInstructions ?? ""}
          onClose={onClose}
          hideHeader
          templatesOnly
          compact
          onCreated={handleCreated}
          sx={{ minHeight: 360 }}
        />
      )}
    </DialogGeneric>
  );
}

DialogPromptIa.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  listingId: PropTypes.string,
  baseMapId: PropTypes.string,
};
