import PropTypes from "prop-types";
import { Box, Chip, CircularProgress, Typography } from "@mui/material";
import { PictureAsPdf as PdfIcon } from "@mui/icons-material";

// The PDFs attached to the conversation, above the input: upload state,
// page count, remove. They stay attached from one message to the next.
export default function ChatPdfAttachments({ attachments, onRemove }) {
  if (!attachments?.length) return null;

  // render

  return (
    <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
      {attachments.map((attachment) => {
        const { id, name, status, pageCount, error } = attachment;
        const pages = pageCount
          ? ` · ${pageCount} page${pageCount > 1 ? "s" : ""}`
          : "";
        return (
          <Box key={id} display="flex" alignItems="center" gap={0.5} minWidth={0}>
            <Chip
              size="small"
              icon={
                status === "uploading" ? (
                  <CircularProgress size={14} />
                ) : (
                  <PdfIcon />
                )
              }
              label={`${name ?? "PDF"}${status === "ready" ? pages : ""}`}
              title={name}
              onDelete={status === "uploading" ? undefined : () => onRemove(id)}
              color={status === "error" ? "error" : "default"}
              sx={{ maxWidth: 260 }}
            />
            {status === "error" && error ? (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

ChatPdfAttachments.propTypes = {
  attachments: PropTypes.array,
  onRemove: PropTypes.func.isRequired,
};
