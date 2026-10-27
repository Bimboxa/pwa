import { Box, Typography } from "@mui/material";

import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import ListHighlightable from "./ListHighlightable";

// Two-column layout of the diagram sections: the highlightable list on the
// left (with the description of the highlighted item and an optional note),
// the SVG diagram (children) on the right.
export default function LayoutDiagramSection({
  title,
  intro,
  items,
  vocabulary,
  highlight,
  note,
  children,
}) {
  // helpers

  const highlightedItem = findItem(items, highlight.highlightedKey);
  const descriptionS = highlightedItem?.description(vocabulary) ?? intro;

  // render

  return (
    <Box sx={{ display: "flex", gap: 3, p: 3, minHeight: "100%" }}>
      <Box
        sx={{
          width: 340,
          minWidth: 340,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            bgcolor: "white",
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            py: 1,
          }}
        >
          <WhiteSectionTitle sx={{ px: 2, pb: 0.5 }}>{title}</WhiteSectionTitle>
          <ListHighlightable
            items={items}
            vocabulary={vocabulary}
            selectedKey={highlight.selectedKey}
            onSelect={highlight.onSelect}
            onHover={highlight.onHover}
          />
        </Box>
        <Typography
          variant="body2"
          sx={{ px: 1, minHeight: 60, color: "text.secondary" }}
        >
          {descriptionS}
        </Typography>
        {note && (
          <Typography variant="caption" sx={{ px: 1, color: "text.disabled" }}>
            {note}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: 1,
            maxWidth: 1200,
            bgcolor: "white",
            borderRadius: 2,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            p: 2,
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

function findItem(items, key) {
  if (!key) return null;
  for (const item of items) {
    if (item.key === key) return item;
    const child = (item.children ?? []).find((c) => c.key === key);
    if (child) return child;
  }
  return null;
}
