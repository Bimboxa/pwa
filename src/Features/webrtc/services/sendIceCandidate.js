import {ref, push, dbPromise} from "Features/firebase/firebaseConfig";

export default async function sendIceCandidate(
  peerConnection,
  candidate,
  role
) {
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
}
