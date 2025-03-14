import {useSelector} from "react-redux";
import useSelectedList from "../hooks/useSelectedList";
import {Box, Icon, Paper, Typography} from "@mui/material";
import ButtonCloseListPanel from "./ButtonCloseListPanel";
import IconList from "./IconList";

import IconButtonListingSelector from "Features/listings/components/IconButtonListingSelector";
import IconButtonMoreInHeader from "./IconButtonMoreInHeader";

export default function ListPanelHeader({open}) {
  // data

  const selectedList = useSelectedList();
  const deviceType = useSelector((s) => s.layout.deviceType);

  // helper

  const name = selectedList?.name ?? "";
  const type = selectedList?.type ?? "DEFAULT";

  return (
    <Box sx={{p: 2, width: 1, display: "flex", alignItems: "center"}}>
      <Paper
        sx={{
          display: open ? "flex" : "none",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
          flex: 1,
        }}
      >
        <IconButtonListingSelector />
        <Typography>{name}</Typography>
        <IconButtonMoreInHeader />
      </Paper>
      {deviceType !== "MOBILE" && <ButtonCloseListPanel />}
    </Box>
  );
}
