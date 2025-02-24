import {useEffect, useState, useRef} from "react";
import {useSelector} from "react-redux";

import {
  createPeerConnection,
  sendOffer,
  listenForAnswer,
  sendIceCandidate,
  listenForIceCandidates,
} from "../services/webrtcService";

import {Button} from "@mui/material";

export default function ButtonSendOffer() {
  // strings

  const label = "Démarrer une connexion";

  // ref

  const peerConnectionRef = useRef(null);

  const setupConnection = async () => {
    try {
      if (peerConnectionRef.current) {
        console.log(
          "⚠️ [desktop] PeerConnection already exists, skipping creation."
        );
        return;
      }
      const {peerConnection} = createPeerConnection(true);
      peerConnectionRef.current = peerConnection;

      console.log("📡 Waiting for answer from mobile...");

      // 🔹 Wait for the answer before proceeding
      listenForAnswer(peerConnection);

      console.log("Proceeding with ICE exchange...");

      // 🔹 Ensure ICE Candidates are exchanged properly
      await sendIceCandidate(peerConnection, "desktop");
      await listenForIceCandidates(peerConnection, "desktop", "mobile");

      console.log("✅ DESKTOP setupConnection");
    } catch (error) {
      console.error("❌ DESKTOP setupConnection failed:", error);
    }
  };

  useEffect(() => {
    console.log("[EFFECT] desktop setupConnection");
    setupConnection();
  }, []);

  // handler

  async function handleClick() {
    if (!peerConnectionRef.current) {
      console.error("❌ peerConnection is not initialized yet!");
      return;
    }
    await sendOffer(peerConnectionRef.current);
  }

  return (
    <Button onClick={handleClick} variant="contained">
      {label}
    </Button>
  );
}
