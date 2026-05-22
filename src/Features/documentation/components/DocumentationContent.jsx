import {forwardRef} from "react";

import {Box, Typography} from "@mui/material";

import MarkdownRenderer from "./markdown/MarkdownRenderer";

const DocumentationContent = forwardRef(function DocumentationContent(
  {status, content, pageId, imageLoaders},
  ref
) {
  return (
    <Box
      ref={ref}
      component="main"
      sx={{
        flex: 1,
        minWidth: 0,
        overflowY: "auto",
        px: {xs: 3, md: 6},
        py: 4,
      }}
    >
      <Box sx={{maxWidth: 820, mx: "auto"}}>
        {status === "loading" && (
          <Typography color="text.secondary">Loading…</Typography>
        )}
        {status === "notfound" && (
          <Box
            sx={{
              p: 3,
              borderRadius: 1,
              bgcolor: "warning.50",
              border: (t) => `1px solid ${t.palette.warning.light}`,
            }}
          >
            <Typography variant="h6" sx={{mb: 1}}>
              Page not found in documentation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No file matches the page id <code>{pageId}</code>.
            </Typography>
          </Box>
        )}
        {status === "error" && (
          <Typography color="error">Failed to load this page.</Typography>
        )}
        {status === "ready" && (
          <MarkdownRenderer
            content={content}
            pageId={pageId}
            imageLoaders={imageLoaders}
          />
        )}
      </Box>
    </Box>
  );
});

export default DocumentationContent;
