import { useState } from "react";

import { List, ListItemButton, Box, Typography, Button } from "@mui/material";
import ImageGeneric from "Features/images/components/ImageGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function ListBaseMapsV2({
  baseMaps,
  onClick,
  onSelectInEditor,
}) {
  // strings

  const openS = "Ouvrir dans l'éditeur";

  // state

  const [overId, setOverId] = useState(null);

  return (
    <List>
      {baseMaps?.map((baseMap) => {
        const isOver = overId === baseMap?.id;
        return (
          <Box
            sx={{ width: 1, p: 1, px: 2, position: "relative" }}
            onMouseOver={() => setOverId(baseMap.id)}
            onMouseLeave={() => setOverId(null)}
          >
            {isOver && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: "8px",
                  left: "50%",
                  zIndex: 3,
                  transform: "translateX(-50%)",
                }}
              >
                <ButtonInPanelV2
                  label={openS}
                  variant="contained"
                  color="secondary"
                  onClick={() => onSelectInEditor(baseMap)}
                />
              </Box>
            )}
            <ListItemButton
              key={baseMap.id}
              onClick={() => onClick(baseMap)}
              sx={{ p: 0, display: "flex", flexDirection: "column" }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                {baseMap?.name}
              </Typography>
              <ImageGeneric
                url={baseMap.image?.imageUrlClient}
                //height="150px"
                //objectFit="cover"
              />
            </ListItemButton>
          </Box>
        );
      })}
    </List>
  );
}
