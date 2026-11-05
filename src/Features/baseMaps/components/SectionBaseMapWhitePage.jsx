import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import { Box, Switch, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import { DEFAULT_WHITE_PAGE_GRID } from "../utils/createWhitePageImage";

import db from "App/db/db";

// Options of a white page base map (baseMap.whitePage) — self-hiding on any
// other base map. The grid is part of the synthesized page image, so it shows
// wherever the base map does (2D, 3D, print): see
// baseMaps/utils/createWhitePageImage.js.
export default function SectionBaseMapWhitePage({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const gridS = "Quadrillage";
  const gridHelperS = "Carreaux de 1 m, trait fort tous les 5 m";

  // helpers

  const whitePage = baseMap?.whitePage;
  const showGrid = Boolean(whitePage?.grid);

  // handlers

  async function handleGridChange(e) {
    if (!baseMap?.id) return;
    await db.baseMaps.update(baseMap.id, {
      whitePage: {
        ...whitePage,
        grid: e.target.checked ? DEFAULT_WHITE_PAGE_GRID : null,
      },
    });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
  }

  // render

  if (!whitePage) return null;

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          px: 1,
        }}
      >
        <Box>
          <Typography variant="body2">{gridS}</Typography>
          <Typography variant="caption" color="text.secondary">
            {gridHelperS}
          </Typography>
        </Box>
        <Switch size="small" checked={showGrid} onChange={handleGridChange} />
      </Box>
    </WhiteSectionGeneric>
  );
}
