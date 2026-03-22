import { Box, Typography } from "@mui/material";

import usePortfolioPageAnnotationsWithDetails from "../hooks/usePortfolioPageAnnotationsWithDetails";
import getPageDimensions from "../utils/getPageDimensions";

export default function SectionPageEntityImages({ page }) {
  // data

  const annotations = usePortfolioPageAnnotationsWithDetails({
    pageId: page?.id,
  });

  // helpers

  const dims = getPageDimensions(page?.format, page?.orientation);

  // render

  if (!annotations.length) return null;

  return (
    <Box sx={{ width: dims.width }}>
      <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5 }}>
        {annotations.length} photo{annotations.length > 1 ? "s" : ""}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 0.5,
        }}
      >
        {annotations.map((annotation) => (
          <Box
            key={annotation.id}
            sx={{
              position: "relative",
              aspectRatio: "1",
              borderRadius: 0.5,
              overflow: "hidden",
              bgcolor: "grey.100",
            }}
          >
            <Box
              component="img"
              src={annotation.entity?.image?.imageUrlClient}
              alt={annotation.label || ""}
              sx={{
                width: 1,
                height: 1,
                objectFit: "cover",
              }}
            />
            {annotation.entity?.num != null && (
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  bgcolor: "rgba(0,0,0,0.5)",
                  color: "white",
                  px: 0.5,
                  fontSize: "0.65rem",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                #{annotation.entity.num}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
