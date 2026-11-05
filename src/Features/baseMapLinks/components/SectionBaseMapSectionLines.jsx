import { Box, List, Typography } from "@mui/material";

import IconSectionLine from "Features/icons/IconSectionLine";

import RowBaseMapSectionLine from "./RowBaseMapSectionLine";
import useBaseMapLinksOfScope from "../hooks/useBaseMapLinksOfScope";

// « Traits de coupe » section of PopperMapListings — Fonds de plan module
// only, on a VERTICAL base map (coupe / élévation), pinned at the top of the
// popper whatever its "Afficher les annotations" switch.
//
// Lists EVERY section mark of the scope (label + plan it was drawn on); the
// button at the end of a row locates the mark on the base map being
// displayed, which links the two and poses the base map in 3D
// (resyncBaseMapLinkPlacementsService). Same card look as the revolution
// axes section (SectionRevolutionAxes). Hidden while the scope has no mark.
export default function SectionBaseMapSectionLines({ baseMap }) {
  // strings

  const titleS = "Traits de coupe";

  // data

  const isVertical = baseMap?.orientation === "VERTICAL";
  const items = useBaseMapLinksOfScope({ enabled: isVertical });

  // render

  if (!isVertical || items.length === 0) return null;

  return (
    <Box
      sx={{
        flexShrink: 0,
        maxHeight: "40%",
        overflow: "auto",
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          mx: 1,
          my: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "panel.border",
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            px: 1,
            py: 0.5,
            bgcolor: "panel.sectionBg",
            borderBottom: "1px solid",
            borderColor: "panel.border",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            color: "panel.textMuted",
          }}
        >
          <IconSectionLine sx={{ fontSize: 14 }} />
          <Typography
            variant="caption"
            sx={{
              color: "panel.textMuted",
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontSize: "11px",
            }}
          >
            {titleS}
          </Typography>
        </Box>
        <List dense disablePadding>
          {items.map(({ link, clone, planBaseMap, locatedBaseMap, lengthM }) => (
            <RowBaseMapSectionLine
              key={link.id}
              link={link}
              clone={clone}
              planBaseMap={planBaseMap}
              locatedBaseMap={locatedBaseMap}
              lengthM={lengthM}
              baseMap={baseMap}
            />
          ))}
        </List>
      </Box>
    </Box>
  );
}
