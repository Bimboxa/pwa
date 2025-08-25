import { useSelector } from "react-redux";

import { Typography } from "@mui/material";

export default function ListPanelClickedItem() {
  // data

  const clickedItem = useSelector((s) => s.listPanel.clickedItem);

  return <Typography>{clickedItem?.type}</Typography>;
}
