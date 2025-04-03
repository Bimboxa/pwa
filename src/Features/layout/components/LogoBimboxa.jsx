import {Box, SvgIcon} from "@mui/material";
import LogoSvg from "Features/layout/assets/logo.svg?react";

export default function LogoBimboxa() {
  return (
    <SvgIcon
      component={LogoSvg}
      inheritViewBox
      sx={{
        fontSize: 240,
      }}
    />
  );
}
