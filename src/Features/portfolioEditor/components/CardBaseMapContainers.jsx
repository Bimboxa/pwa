import { useLiveQuery } from "dexie-react-hooks";

import usePortfolioBaseMapContainers from "Features/portfolioBaseMapContainers/hooks/usePortfolioBaseMapContainers";

import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { Map as MapIcon } from "@mui/icons-material";

import db from "App/db/db";

export default function CardBaseMapContainers({ pageId }) {
  // data

  const { value: containers } = usePortfolioBaseMapContainers({
    filterByPageId: pageId,
  });

  const baseMapIds = (containers || [])
    .map((c) => c.baseMapId)
    .filter(Boolean);

  const baseMaps = useLiveQuery(async () => {
    if (!baseMapIds.length) return [];
    const records = await db.baseMaps.bulkGet(baseMapIds);
    return records.filter(Boolean);
  }, [baseMapIds.join(",")]);

  // helpers

  const baseMapById = new Map((baseMaps || []).map((bm) => [bm.id, bm]));

  // render

  if (!containers?.length) return null;

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Fonds de plan
        </Typography>
      </Box>

      <List dense disablePadding>
        {containers.map((container) => {
          const bm = baseMapById.get(container.baseMapId);
          const label = bm?.name ?? "Empty container";
          return (
            <ListItemButton key={container.id} sx={{ py: 0.5, px: 2 }}>
              <ListItemIcon sx={{ minWidth: 32 }}>
                <MapIcon fontSize="small" sx={{ opacity: 0.6 }} />
              </ListItemIcon>
              <ListItemText
                primary={label}
                slotProps={{
                  primary: { variant: "body2", noWrap: true },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
