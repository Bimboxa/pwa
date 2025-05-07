import {Box} from "@mui/material";

import logo from "../assets/logo512.png";

export default function LogoAnimated() {
  return (
    <Box
      sx={{
        backgroundSize: "contain", //: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center center",
        position: "relative",
        backgroundImage: `url(${logo})`,
        height: 300,
        width: 300,
        borderRadius: "4px",
        animation: `ripple 1s ease-in-out alternate infinite`,
        "@keyframes ripple": {
          "0%": {
            transform: "scale(1)",
            opacity: 1,
            filter: "grayScale(0)",
          },
          "100%": {
            transform: "scale(0.95)",
            opacity: 0.8,
            filter: "grayScale(0.1)",
          },
        },
      }}
    />
  );
}
