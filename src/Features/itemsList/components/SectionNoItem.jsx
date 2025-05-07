import BoxCenter from "Features/layout/components/BoxCenter";
import {Typography} from "@mui/material";

export default function SectionNoItem({noItemLabel}) {
  return (
    <BoxCenter>
      <Typography color="text.secondary">{noItemLabel}</Typography>
    </BoxCenter>
  );
}
