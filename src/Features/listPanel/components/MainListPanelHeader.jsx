import useSelectedList from "../hooks/useSelectedList";
import {Box, Icon, Paper, Typography} from "@mui/material";
import ButtonCloseListPanel from "./ButtonCloseListPanel";
import IconList from "./IconList";
import IconButtonMoreInHeader from "./IconButtonMoreInHeader";

export default function MainListPanelHeader({open}) {
  // data

  const selectedList = useSelectedList();

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
        <IconList type={type} />
        <Typography>{name}</Typography>
        <IconButtonMoreInHeader />
      </Paper>
      <ButtonCloseListPanel />
    </Box>
  );
}
