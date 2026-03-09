import { useSelector } from "react-redux";

import { Box, Typography, Divider } from "@mui/material";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import SectionBaseMap from "./SectionBaseMap";

export default function MainListingMapsEditor({ listing }) {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps({ filterByProject: projectId });
  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listing?.id,
    sortByLabel: true,
  });

  // helpers

  const hasBaseMaps = baseMaps?.length > 0;

  // render

  if (!listing) {
    return (
      <Box
        sx={{
          width: 1,
          height: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Typography color="text.secondary">
          Select a listing to view base maps.
        </Typography>
      </Box>
    );
  }

  if (!hasBaseMaps) {
    return (
      <Box
        sx={{
          width: 1,
          height: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Typography color="text.secondary">No base maps found.</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        overflow: "auto",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      {baseMaps.map((baseMap, index) => (
        <Box key={baseMap.id}>
          <SectionBaseMap
            baseMap={baseMap}
            listing={listing}
            annotationTemplates={annotationTemplates}
          />
          {index < baseMaps.length - 1 && <Divider sx={{ my: 2 }} />}
        </Box>
      ))}
    </Box>
  );
}
