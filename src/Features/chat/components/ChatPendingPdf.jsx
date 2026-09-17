import {
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { PictureAsPdf as PdfIcon } from "@mui/icons-material";

// The PDF waiting above the input: upload state, page selector (one page per
// run), remove.
export default function ChatPendingPdf({ pendingPdf, onPageChange, onClear }) {
  if (!pendingPdf) return null;
  const { status, fileName, pageCount, pageNumber, error } = pendingPdf;

  return (
    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
      <Chip
        size="small"
        icon={
          status === "uploading" ? <CircularProgress size={14} /> : <PdfIcon />
        }
        label={fileName ?? "PDF"}
        onDelete={status === "uploading" ? undefined : onClear}
        color={status === "error" ? "error" : "default"}
        sx={{ maxWidth: 1 }}
      />
      {status === "ready" && pageCount > 1 ? (
        <>
          <Typography variant="caption">Page</Typography>
          <Select
            size="small"
            variant="standard"
            value={pageNumber}
            onChange={(e) => onPageChange(Number(e.target.value))}
            MenuProps={{ PaperProps: { sx: { maxHeight: 300 } } }}
          >
            {Array.from({ length: pageCount }, (_, i) => (
              <MenuItem key={i + 1} value={i + 1}>
                {i + 1} / {pageCount}
              </MenuItem>
            ))}
          </Select>
        </>
      ) : null}
      {status === "error" && error ? (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      ) : null}
    </Box>
  );
}
