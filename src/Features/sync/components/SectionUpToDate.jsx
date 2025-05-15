import {Box, Typography} from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function SectionUpToDate() {
  const upToDateS = "Aucune modification locale à synchroniser";
  return (
    <BoxCenter sx={{p: 3}}>
      <Typography color="text.secondary" align="center">
        {upToDateS}
      </Typography>
    </BoxCenter>
  );
}
