import { useState } from "react";
import { Grid, Box, Typography, Button, ListItemButton } from "@mui/material";

import SectionCreateBaseMap from "./SectionCreateBaseMap";

export default function ListBaseMapsVariantGrid({
  baseMaps,
  selection,
  onClick,
  createContainerEl,
}) {
  // helpers

  const newS = "+";

  // state

  const [openCreate, setOpenCreate] = useState(false);

  // helpers

  const bbox = createContainerEl?.getBoundingClientRect();
  console.log("bbox", bbox);

  if (openCreate)
    return (
      <Box
        sx={{
          position: "fixed",
          zIndex: 10,
          top: bbox?.top,
          left: bbox?.left,
          width: bbox?.width,
          bgcolor: "white",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          boxShadow: 1,
        }}
      >
        <SectionCreateBaseMap onClose={() => setOpenCreate(false)} />
      </Box>
    );

  return (
    <Grid container spacing={2} columns={12}>
      {baseMaps?.map((baseMap) => {
        const selected = selection?.includes(baseMap.id);
        return (
          <Grid size={6}>
            <ListItemButton
              sx={{
                p: 0,
                ...(selected && {
                  border: (theme) =>
                    `2px solid ${theme.palette.secondary.main}`,
                }),
              }}
              onClick={() => onClick(baseMap)}
            >
              <Box
                sx={{
                  width: 1,
                  height: "100px",
                  backgroundImage: `url(${baseMap.getUrl()})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "end",
                }}
              >
                <Box
                  sx={{
                    bgcolor: "white",
                    display: "flex",
                  }}
                >
                  <Typography noWrap variant="caption">
                    {baseMap.name}
                  </Typography>
                </Box>
              </Box>
            </ListItemButton>
          </Grid>
        );
      })}
      <Grid size={6}>
        <Box
          sx={{
            display: "flex",
            height: "50px",
            bgcolor: "background.default",
          }}
        >
          <Button
            fullWidth
            sx={{ height: 1 }}
            onClick={() => setOpenCreate(true)}
          >
            <Typography>{newS}</Typography>
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
}
