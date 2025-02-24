import {setDataChannel, handleWebRTCMessage} from "../webrtcMiddleware";
import store from "App/store";

import {
  dbPromise,
  ref,
  set,
  push,
  onValue,
} from "Features/firebase/firebaseConfig";

const configuration = {
  iceServers: [{urls: "stun:stun.l.google.com:19302"}],
};

export const createPeerConnection = (createDataChannel = false) => {
  const peerConnection = new RTCPeerConnection(configuration);
  let dataChannel = null;

  if (createDataChannel) {
    // Only the caller (Desktop) should create a DataChannel
    dataChannel = peerConnection.createDataChannel("shapesSync");
    console.log("📡 Created DataChannel on Caller");

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

  return {peerConnection, dataChannel};
};

export const listenForOffer = async (peerConnection) => {
  const db = await dbPromise;

  try {
    console.log("📡 MOBILE is now listening for WebRTC offer...");

    // ✅ Listen for real-time updates
    onValue(ref(db, "webrtc/offer"), async (snapshot) => {
      if (!snapshot.exists()) {
        console.warn("⚠️ No offer found in database.");
        return;
      }

      const offer = snapshot.val();
      console.log("✅ MOBILE received offer:", offer);

      // Ensure we don't set the remote description twice
      if (!peerConnection.remoteDescription) {
        // - pc description -
        // await peerConnection.setRemoteDescription(
        //   new RTCSessionDescription(offer)
        // );
        console.log("✅ MOBILE-remote (=>offer)");
        console.log("[Signaling State]", peerConnection.signalingState);

        // - send answer -
        await sendAnswer(peerConnection);
      } else {
        console.warn(
          "⚠️ Offer received but already set as MOBILE-remote. Ignoring."
        );
      }
    });
  } catch (e) {
    console.error("❌ Error listening for offer by MOBILE", e);
  }
};

export const listenForAnswer = async (peerConnection) => {
  const db = await dbPromise;
  try {
    const pcState = peerConnection.signalingState;
    const pcRemote = peerConnection.remoteDescription;
    console.log("📡 DESKTOP listening for answer...", pcState, pcRemote);

    onValue(ref(db, "webrtc/answer"), async (snapshot) => {
      if (snapshot.exists()) {
        const answer = snapshot.val();
        console.log("✅ DESKTOP receives answer", peerConnection);

        // - send candidates -
        await sendIceCandidate(peerConnection, "desktop");

        // - pc description -
        if (
          !peerConnection.remoteDescription
          // peerConnection.signalingState !== "stable"
        ) {
          // await peerConnection.setRemoteDescription(
          //   new RTCSessionDescription(answer)
          // );
          console.log("✅ DESKTOP - remote (=>answer)");
          console.log("[Signaling State]", peerConnection.signalingState);
        } else {
          console.warn(
            "⚠️ DESKTOP can't set remote, skipping.",
            pcState,
            pcRemote
          );
        }
      } else {
        console.warn("⚠️ No answer found in database.");
      }
    });
  } catch (e) {
    console.log("❌ Error listening answer by DESKTOP", e);
  }
};

export const sendIceCandidate = async (peerConnection, role) => {
  const db = await dbPromise;

  if (!db) {
    console.error(`❌ Firebase. Cannot send ICE candidates.`);
    return;
  }

  try {
    const pcState = peerConnection.signalingState;
    const pcRemote = peerConnection.remoteDescription;

    // EDGE CASE
    // need to have a remote description before sending ICE candidates
    if (!pcRemote || pcState === "stable") {
      console.warn(
        `⚠️ ${role} can't send ICE, skipping ICE.`,
        pcState,
        pcRemote
      );
      return;
    }

    // MAIN
    const candidate = await new Promise((resolve) => {
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          resolve(event.candidate);
        }
      };
    });
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    console.log(`✅ [pc] ICE candidate added for ${role}`);

    const firebaseCandidate = {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
    };
    await push(ref(db, `webrtc/${role}/iceCandidates`), firebaseCandidate);

    console.log(`✅ [firebase] ICE candidate ${role}:`, candidate);
  } catch (e) {
    console.log(`❌ Error sending ICE candidate by ${role}`, e);
  }
};

export const listenForIceCandidates = async (
  peerConnection,
  listenerRole,
  fromRole
) => {
  const db = await dbPromise;

  try {
    console.log(
      `📡 ${listenerRole} is now listening for ICE candidates from ${fromRole}...`
    );

    // Listen for real-time updates
    onValue(ref(db, `webrtc/${fromRole}/iceCandidates`), async (snapshot) => {
      if (!snapshot.exists()) {
        console.warn(`⚠️ No ICE candidates found for ${fromRole}.`);
        return;
      }

      snapshot.forEach(async (child) => {
        const candidate = child.val();

        // ✅ Ensure ICE candidates are only added after remoteDescription is set
        if (peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(
            `✅ [${listenerRole}] ICE candidate from ${fromRole} added`
          );
        } else {
          console.warn(
            `⚠️ [${listenerRole}] Received ICE before remoteDescription, skipping...`
          );
        }
      });
    });
  } catch (e) {
    console.error(
      `❌ [${listenerRole}] Error listening ICE candidates from ${fromRole}`,
      e
    );
  }
};
