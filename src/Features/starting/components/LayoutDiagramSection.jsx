import { Box, Typography } from "@mui/material";

import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import ListHighlightable from "./ListHighlightable";

import { CARD_BORDER } from "Features/dashboard/utils/dashboardStyles";

// Layout of the diagram sections: a narrow dense column on the left (the
// highlightable list, the description of the highlighted item, an optional
// note), the SVG diagram (children) taking every remaining pixel on the
// right — the diagram is what the page is about.
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
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        gap: 2,
        px: 3,
        pb: 2,
        pt: 1,
      }}
    >
      <Box
        sx={{
          width: 250,
          minWidth: 250,
          display: "flex",
          flexDirection: "column",
          gap: 1,
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            bgcolor: "white",
            borderRadius: 2,
            border: `1px solid ${CARD_BORDER}`,
            py: 0.5,
            overflow: "auto",
          }}
        >
          <WhiteSectionTitle sx={{ px: 1.5, py: 0.5 }}>
            {title}
          </WhiteSectionTitle>
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
          sx={{ px: 0.5, minHeight: 56, color: "text.secondary" }}
        >
          {descriptionS}
        </Typography>
        {note && (
          <Typography
            variant="caption"
            sx={{ px: 0.5, color: "text.disabled" }}
          >
            {note}
          </Typography>
        )}
      </Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          bgcolor: "white",
          borderRadius: 2,
          border: `1px solid ${CARD_BORDER}`,
          boxShadow: "0 2px 10px rgba(28,27,26,.06)",
          p: 1.5,
        }}
      >
        {children}
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
