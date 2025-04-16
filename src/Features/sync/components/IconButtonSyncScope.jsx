import {useState} from "react";

import useScope from "Features/scopes/hooks/useScope";

import {IconButton} from "@mui/material";
import {Refresh} from "@mui/icons-material";

export default function IconButtonSyncScope() {
  // data

  const scope = useScope();
  console.log("[debug] scope", scope);

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  function handleClick() {
    console.log("handleClick");
  }
  return (
    <IconButton onClick={handleClick} loading={loading}>
      <Refresh />
    </IconButton>
  );
}
