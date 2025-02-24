import {dbPromise, ref, onValue} from "Features/firebase/firebaseConfig";

export default async function listenForIceCandidates(
  peerConnection,
  local,
  remote
) {
  const db = await dbPromise;

  try {
    console.log(
      `📡 ${local} is now listening for ICE candidates from ${remote}...`
    );

    // Listen for real-time updates
    onValue(ref(db, `webrtc/${remote}/iceCandidates`), async (snapshot) => {
      if (!snapshot.exists()) {
        console.warn(`⚠️ No ICE candidates found for ${remote}.`);
        return;
      }

      snapshot.forEach(async (child) => {
        const candidate = child.val();

        // ✅ Ensure ICE candidates are only added after remoteDescription is set
        if (peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log(`✅ [${local}] ICE candidate from ${remote} added`);
        } else {
          console.warn(
            `⚠️ [${local}] Received ICE before remoteDescription, skipping...`
          );
        }
      });
    });
  } catch (e) {
    console.error(
      `❌ [${local}] Error listening ICE candidates from ${remote}`,
      e
    );
  }
}
