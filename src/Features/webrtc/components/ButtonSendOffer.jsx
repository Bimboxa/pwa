import {useEffect, useState, useRef} from "react";
import {useSelector} from "react-redux";

import sendOffer from "../services/sendOffer";

import {Button} from "@mui/material";

import createPeerConnection from "../services/createPeerConnection";
import listenForAnswer from "../services/listenForAnswer";
import listenForIceCandidates from "../services/listenForIceCandidates";
import sendIceCandidate from "../services/sendIceCandidate";

export default function ButtonSendOffer() {
  // strings

  const label = "Démarrer une connexion";

  // state

  const [offerSent, setOfferSent] = useState(false);

  // ref

  const peerConnectionRef = useRef(null);

  useEffect(() => {
    const {peerConnection} = createPeerConnection("desktop", "mobile");
    peerConnectionRef.current = peerConnection;
  }, []);

  useEffect(() => {
    if (offerSent) {
      listenForAnswer(peerConnectionRef.current, sendIceCandidate);
      listenForIceCandidates(peerConnectionRef.current, "mobile", "desktop");
    }
  }, [offerSent]);

  // handler

  function handleClick() {
    if (!peerConnectionRef.current) {
      console.error("❌ peerConnection is not initialized yet!");
      return;
    }
    sendOffer(peerConnectionRef.current);
    setOfferSent(true);
  }

  return (
    <Button onClick={handleClick} variant="contained">
      {label}
    </Button>
  );
}
