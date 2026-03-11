import { useState, useMemo } from "react";
import { useSelector } from "react-redux";

import { Box, Typography, Divider } from "@mui/material";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import SectionBaseMap from "./SectionBaseMap";
import SectionCrossBaseMaps from "./SectionCrossBaseMaps";

const QTY_MODES = {
  ANNOTATIONS: "ANNOTATIONS",
  ARTICLES: "ARTICLES",
};

export default function MainListingMapsEditor({ listing, showAllListings }) {
  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps({ filterByProject: projectId });

  const filterByListingId = showAllListings ? undefined : listing?.id;

  const annotationTemplates = useAnnotationTemplates({
    filterByListingId,
    sortByLabel: true,
  });

  const allAnnotations = useAnnotationsV2({
    filterByListingId,
    excludeIsForBaseMapsListings: true,
    excludeBgAnnotations: true,
    withQties: true,
    withListingName: showAllListings,
  });

  // state

  const [qtyMode, setQtyMode] = useState(QTY_MODES.ANNOTATIONS);

  // helpers

  const hasBaseMaps = baseMaps?.length > 0;

  const annotationsByBaseMapId = useMemo(() => {
    if (!allAnnotations) return {};
    const map = {};
    for (const a of allAnnotations) {
      if (!a.baseMapId) continue;
      if (!map[a.baseMapId]) map[a.baseMapId] = [];
      map[a.baseMapId].push(a);
    }
    return map;
  }, [allAnnotations]);

  // render

  if (!listing && !showAllListings) {
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
      <SectionCrossBaseMaps
        listing={listing}
        showAllListings={showAllListings}
        annotations={allAnnotations}
        annotationTemplates={annotationTemplates}
        qtyMode={qtyMode}
        onQtyModeChange={setQtyMode}
      />
      <Divider sx={{ my: 2 }} />
      {baseMaps.map((baseMap, index) => (
        <Box key={baseMap.id}>
          <SectionBaseMap
            baseMap={baseMap}
            listing={listing}
            annotationTemplates={annotationTemplates}
            annotations={annotationsByBaseMapId[baseMap.id] ?? []}
            showAllListings={showAllListings}
            qtyMode={qtyMode}
          />
          {index < baseMaps.length - 1 && <Divider sx={{ my: 2 }} />}
        </Box>
      ))}
    </Box>
  );
}
