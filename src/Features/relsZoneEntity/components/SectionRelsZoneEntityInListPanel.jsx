import {Box} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderRelsZoneEntity from "./HeaderRelsZoneEntity";
import SectionSelectedEntityZones from "./SectionSelectedEntityZones";

export default function SectionRelsZoneEntityInListPanel() {
  return (
    <BoxFlexVStretch>
      <HeaderRelsZoneEntity />
      <SectionSelectedEntityZones />
    </BoxFlexVStretch>
  );
}
