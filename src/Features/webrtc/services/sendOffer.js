import {dbPromise, set, ref} from "Features/firebase/firebaseConfig";

export default async function sendOffer(peerConnection) {
  const db = await dbPromise;
  try {
    const pcState = peerConnection.signalingState;
    const pcRemote = peerConnection.remoteDescription;

    // EDGE CASE
    if (pcState !== "stable") {
      console.warn(
        `⚠️ DESKTOP can't send offer, skipping offer.`,
        pcState,
        pcRemote
      );
      return;
    }

    const offer = await peerConnection.createOffer();

    // - pc description -
    await peerConnection.setLocalDescription(offer);
    console.log("✅ DESKTOP-local (offer=>)");
    console.log("[Signaling State]", peerConnection.signalingState);

    // - firebase -
    if (db) await set(ref(db, "webrtc/offer"), offer);
    console.log("✅ offer sent by DESKTOP");
  } catch (e) {
    console.log("❌ Error sending offer by DESKTOP", e);
  }
}
