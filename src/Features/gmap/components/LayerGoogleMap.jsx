import { Box } from "@mui/material";
import ButtonGoogleMapScreenshot from "./ButtonGoogleMapScreenshot";

export default function LayersGoogleMap({ gmap, gmapContainer }) {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          bottom: "8px",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <ButtonGoogleMapScreenshot map={gmap} mapContainer={gmapContainer} />
      </Box>
    </>
  );
}
