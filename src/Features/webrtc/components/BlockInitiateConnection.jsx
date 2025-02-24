import {useSelector} from "react-redux";

import {Paper} from "@mui/material";
import ButtonInitiateConnection from "./ButtonInitiateConnection";

export default function BlockInitiateConnection() {
  const qrCode = useSelector((s) => s.webrtc.qrCodeDataURL);
  return (
    <Paper sx={{p: 1}}>
      {qrCode && <img src={qrCode} alt="QR Code" />}
      {!qrCode && <ButtonInitiateConnection />}
    </Paper>
  );
}
