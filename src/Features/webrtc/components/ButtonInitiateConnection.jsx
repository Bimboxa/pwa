import {useDispatch} from "react-redux";

import {initiateConnection} from "../webrtcSlice";

import {Button} from "@mui/material";

export default function ButtonInitiateConnection() {
  const dispatch = useDispatch();

  // string

  const label = "Initialiser un appareillage mobile";

  // handlers

  function handleClick() {
    dispatch(initiateConnection());
  }

  return (
    <Button variant="contained" color="primary" onClick={handleClick}>
      {label}
    </Button>
  );
}
