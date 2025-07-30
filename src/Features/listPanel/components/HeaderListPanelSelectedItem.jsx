import { Box, Typography } from "@mui/material";

import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function HeaderListPanelSelectedItem({ item, onClose }) {
  return (
    <Box sx={{ p: 1, width: 1 }}>
      <Box
        sx={{
          p: 1,
          width: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
        }}
      >
        <Typography>{item?.name}</Typography>
        <IconButtonClose onClose={onClose}></IconButtonClose>
      </Box>
    </Box>
  );
}
