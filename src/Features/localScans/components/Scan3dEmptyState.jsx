/* eslint-disable react/prop-types */
import { Box, Button, Stack } from "@mui/material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import scanRoom from "../assets/scanRoom.svg";

export default function Scan3dEmptyState({ onLoad }) {
  return (
    <WhiteSectionGeneric>
      <Stack spacing={1} sx={{ p: 1, alignItems: "center" }}>
        <Box
          component="img"
          src={scanRoom}
          alt=""
          aria-hidden="true"
          sx={{
            display: "block",
            width: "100%",
            maxWidth: 360,
            aspectRatio: "440 / 250",
          }}
        />
        <Button variant="outlined" fullWidth onClick={onLoad}>
          Charger un scan 3D
        </Button>
      </Stack>
    </WhiteSectionGeneric>
  );
}
