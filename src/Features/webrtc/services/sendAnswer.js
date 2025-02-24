import {dbPromise, set, ref} from "Features/firebase/firebaseConfig";

export default async function sendAnswer(peerConnection, onSentAnswer) {
  const db = await dbPromise;
  try {
    const pcState = peerConnection.signalingState;
    const pcRemote = peerConnection.remoteDescription;

    // EDGE CASE
    if (pcState !== "have-remote-offer" && pcState !== "have-local-pranswer") {
      console.warn(
        `⚠️ MOBILE can't send answer, skipping answer.`,
        pcState,
        pcRemote
      );
      return;
    }

    const answer = await peerConnection.createAnswer();
    console.log("[Signaling State]", peerConnection.signalingState);

    // - pc description -
    await peerConnection.setLocalDescription(answer);
    console.log("✅ MOBILE - local => answer");

    // - firebase -
    if (db) await set(ref(db, "webrtc/answer"), answer);
    console.log("[db] ✅ answer sent by MOBILE");

    // - callback -
    if (onSentAnswer) onSentAnswer();
    //sendIceCandidate(peerConnection, "mobile");
  } catch (e) {
    console.log("❌ Error sending answer by MOBILE", e);
  }
}
