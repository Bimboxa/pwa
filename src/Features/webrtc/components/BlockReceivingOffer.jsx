import {useEffect, useState, useRef} from "react";

import {Typography, Box} from "@mui/material";

import createPeerConnection from "../services/createPeerConnection";
import listenForOffer from "../services/listenForOffer";
import sendAnswer from "../services/sendAnswer";
import sendIceCandidate from "../services/sendIceCandidate";
import listenForIceCandidates from "../services/listenForIceCandidates";

export default function BlockReceivingOffer() {
  console.log("[BlockReceivingOffer]");
  // strings

  const waitingS = "En attente...";
  const connectedS = "Connecté !";

  // state

  const [connected, setConnected] = useState(false);

  // helpers

  const label = connected ? connectedS : waitingS;

  const peerConnectionRef = useRef(null);

  // effect

  useEffect(() => {
    const {peerConnection} = createPeerConnection(false);
    peerConnectionRef.current = peerConnection;
    listenForOffer(peerConnection, sendAnswer, sendIceCandidate);
    listenForIceCandidates(peerConnection, "mobile", "desktop");
  }, []);

  return (
    <Box>
      <Typography>{label}</Typography>
    </Box>
  );
}
