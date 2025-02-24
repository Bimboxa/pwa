import {useEffect, useState, useRef} from "react";
import {
  createPeerConnection,
  listenForOffer,
  sendAnswer,
  sendIceCandidate,
  listenForIceCandidates,
} from "Features/webrtc/services/webrtcService";

import {Typography, Box} from "@mui/material";

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

  const setupConnection = async () => {
    try {
      if (peerConnectionRef.current) {
        console.log(
          "⚠️ [mobile] PeerConnection already exists, skipping creation."
        );
        return;
      }
      // Create peer connection
      const {peerConnection} = createPeerConnection(false);
      peerConnectionRef.current = peerConnection;

      console.log("📡 MOBILE waiting for an offer ...");

      await listenForOffer(peerConnection);

      console.log("📡 MOBILE creating answer...");

      await sendAnswer(peerConnection);

      // 🔹 Handle ICE candidates (only after receiving an offer)
      await sendIceCandidate(peerConnection, "mobile");
      await listenForIceCandidates(peerConnection, "mobile", "desktop");

      setConnected(true);
      console.log("✅ MOBILE setupConnection");
    } catch (error) {
      console.error("❌ MOBILE setupConnection failed:", error);
    }
  };

  // effect

  useEffect(() => {
    console.log("[EFFECT] mobile setupConnection");
    setupConnection();
  }, []);

  return (
    <Box>
      <Typography>{label}</Typography>
    </Box>
  );
}
