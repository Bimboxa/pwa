import {dbPromise, ref, onValue} from "Features/firebase/firebaseConfig";

export default async function listenForAnswer(
  peerConnection,
  sendIceCandidate
) {
  const db = await dbPromise;

  let answerReceived = false;

  try {
    const pcState = peerConnection.signalingState;
    const pcRemote = peerConnection.remoteDescription;
    console.log("📡 DESKTOP listening for answer...", pcState, pcRemote);

    onValue(ref(db, "webrtc/answer"), async (snapshot) => {
      try {
        if (answerReceived) {
          console.warn("⚠️ Answer already received. Skipping.");
          return;
        }

        if (snapshot.exists()) {
          answerReceived = true;
          const answer = snapshot.val();
          console.log("✅ DESKTOP receives answer", peerConnection);

          // - pc description -
          console.log(
            "✅ DESKTOP received answer",
            peerConnection.signalingState
          );
          if (peerConnection.signalingState === "stable") {
            console.log(
              "⚠️ DESKTOP can't set remote with state stable, skipping."
            );
            return;
          }
          if (peerConnection.signalingState === "have-local-offer") {
            await peerConnection.setRemoteDescription(
              new RTCSessionDescription(answer)
            );

            console.log("✅ DESKTOP - remote (=>answer)");
            console.log("[Signaling State]", peerConnection.signalingState);

            sendIceCandidate(peerConnection, "desktop");
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
      } catch (e) {
        console.log("❌ DESKTOP error while getting update from firefox", e);
      }
    });
  } catch (e) {
    console.log("❌ Error listening answer by DESKTOP", e);
  }
}
