import { useMemo } from "react";

import { Box, List, Typography } from "@mui/material";

import RowBaseMapLinkClone from "./RowBaseMapLinkClone";
import useBaseMapLinksToBaseMap from "../hooks/useBaseMapLinksToBaseMap";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

// "Coupes / élévations liées" section of PopperMapListings — rendered on a
// VERTICAL base map targeted by at least one BASE_MAP_LINK section mark, just
// above the drawing tools. One row per incoming link: drawing its clone on
// this base map is what poses the base map in 3D (see
// resyncBaseMapLinkPlacementsService).
export default function SectionBaseMapLinkClones({
  baseMap,
  annotationTemplateById,
  spriteImage,
}) {
  // strings

  const titleS = "Coupes / élévations liées";

  // data

  const items = useBaseMapLinksToBaseMap(baseMap?.id);
  const { value: baseMaps } = useBaseMaps({ includeDetails: true });

  // helpers

  const baseMapById = useMemo(() => {
    const acc = {};
    for (const bm of baseMaps ?? []) acc[bm.id] = bm;
    return acc;
  }, [baseMaps]);

  // render

  if (baseMap?.orientation !== "VERTICAL") return null;
  if (!items || items.length === 0) return null;

  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "panel.border" }}>
      {/* Same typography as the "Nouvelle zone" section header. */}
      <Box sx={{ px: 1, py: 0.75, bgcolor: "secondary.main" }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "secondary.contrastText" }}
        >
          {titleS}
        </Typography>
      </Box>
      <List dense disablePadding>
        {items.map(({ link, clone }) => (
          <RowBaseMapLinkClone
            key={link.id}
            link={link}
            clone={clone}
            template={annotationTemplateById?.[link.annotationTemplateId]}
            planBaseMap={baseMapById[link.baseMapId]}
            spriteImage={spriteImage}
          />
        ))}
      </List>
    </Box>
  );
}
