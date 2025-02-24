import {dbPromise, onValue, ref} from "Features/firebase/firebaseConfig";
import {off} from "firebase/database";

export default async function listenForOffer(
  peerConnection,
  sendAnswer,
  sendIceCandidate
) {
  const db = await dbPromise;

  const pcState = peerConnection.signalingState;
  const pcRemote = peerConnection.remoteDescription;

  let offerReceived = false;

  try {
    console.log("📡 MOBILE is now listening for WebRTC offer...");

    // ✅ Listen for real-time updates
    onValue(ref(db, "webrtc/offer"), async (snapshot) => {
      if (offerReceived) {
        console.warn("⚠️ Offer already received. Skipping.");
        return;
      }

      if (!snapshot.exists()) {
        console.warn("⚠️ No offer found in database.");
        return;
      }

      const offer = snapshot.val();
      console.log("✅ MOBILE received offer:", offer);
      offerReceived = true;

      // Ensure we don't set the remote description twice
      if (pcState === "stable" && !pcRemote) {
        // - pc description -
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer)
        );
        console.log("✅ MOBILE-remote (=>offer)");
        console.log("[Signaling State]", peerConnection.signalingState);

        // - callback -
        if (peerConnection.signalingState === "have-remote-offer") {
          sendAnswer(peerConnection);
          sendIceCandidate(peerConnection, "mobile");
        }
      } else {
        console.warn(
          "⚠️ Offer received but already set as MOBILE-remote. Ignoring."
        );
      }
    });
  } catch (e) {
    console.error("❌ Error listening for offer by MOBILE", e);
  }
}
