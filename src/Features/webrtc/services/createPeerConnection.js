import {setDataChannel, handleWebRTCMessage} from "../webrtcMiddleware";
import store from "App/store";

const configuration = {
  iceServers: [{urls: "stun:stun.l.google.com:19302"}],
};

export default function createPeerConnection(local, remote) {
  const peerConnection = new RTCPeerConnection(configuration);
  let dataChannel = null;

  /*
   * ------ CHANNEL ------
   */
  if (local === "desktop") {
    // Only the caller (Desktop) should create a DataChannel
    dataChannel = peerConnection.createDataChannel("shapesSync");
    console.log("📡 Created DataChannel on DESKTOP");

    dataChannel.onopen = () => {
      console.log("✅ DataChannel is open and ready to use.");
      setDataChannel(dataChannel);
    };

    dataChannel.onerror = (error) =>
      console.error("❌ DataChannel error:", error);

    dataChannel.onmessage = (event) => {
      console.log("📩 Received message:", event.data);
      handleWebRTCMessage(store)(event);
    };
  }

  // Handle incoming DataChannel (Only on Mobile)
  peerConnection.ondatachannel = (event) => {
    console.log("📡 Received DataChannel from caller.");
    const receivedChannel = event.channel;

    receivedChannel.onopen = () => {
      console.log("✅ Received DataChannel is open!");
      setDataChannel(receivedChannel);
    };

    receivedChannel.onerror = (error) =>
      console.error("❌ Received DataChannel error:", error);

    receivedChannel.onmessage = (event) => {
      console.log("📩 Received message:", event.data);
      handleWebRTCMessage(store)(event);
    };
  };

  /*
   * ------ ICE CANDIDATE ------
   */

  //   peerConnection.onicecandidate = async (event) => {
  //     const candidate = event.candidate;
  //     if (candidate) sendIceCandidate(peerConnection, candidate, local);
  //   };

  return {peerConnection, dataChannel};
}
