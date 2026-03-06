import { useSelector } from "react-redux";

import { Box, Typography, Grid } from "@mui/material";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import CardBaseMap from "./CardBaseMap";

export default function MainListingMapsEditor({ listing }) {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps({ filterByProject: projectId });

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
      <Grid container spacing={2} columns={2}>
        {baseMaps.map((baseMap) => (
          <Grid key={baseMap.id} size={1}>
            <CardBaseMap baseMap={baseMap} listing={listing} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
