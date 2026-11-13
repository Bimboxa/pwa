import { Box } from "@mui/material";

import TileImageAnnotation from "./TileImageAnnotation";
import { isImageAnnotationVeiled } from "../utils/imageAnnotationSelection";

// Grid of the photos, `columns` wide (GridPhotos pattern).
export default function GridImageAnnotations({
  images,
  indexById,
  selectedImageId,
  onSelect,
  onFullscreen,
  registerEl,
  columns = 2,
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 1,
        p: 1,
      }}
    >
      {images.map((a) => (
        <TileImageAnnotation
          key={a.id}
          annotation={a}
          number={indexById?.[a.id]}
          selected={a.id === selectedImageId}
          veiled={isImageAnnotationVeiled(a.id, selectedImageId)}
          onSelect={onSelect}
          onFullscreen={onFullscreen}
          registerEl={registerEl}
        />
      ))}
    </Box>
  );
}
