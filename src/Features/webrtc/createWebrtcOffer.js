import QRCode from "qrcode";

const createWebrtcOffer = async (setQrCodeUrl) => {
  const peerConnection = new RTCPeerConnection({
    iceServers: [
      {urls: "stun:stun.l.google.com:19302"},
      {urls: "stun:stun.services.mozilla.com"},
    ], // No external server needed
  });

  const dataChannel = peerConnection.createDataChannel("redux-sync");

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Generate QR Code
  const qrData = JSON.stringify({offer});
  const qrCodeUrl = await QRCode.toDataURL(qrData);
  setQrCodeUrl(qrCodeUrl);

  return {peerConnection, dataChannel};
};

export default createWebrtcOffer;
