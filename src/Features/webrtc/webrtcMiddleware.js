let dataChannel = null;

console.log("dataChannel", dataChannel);

const webrtcMiddleware = (store) => (next) => (action) => {
  const result = next(action);
  if (dataChannel && dataChannel.readyState === "open") {
    if (action.type.startsWith("shapes/")) {
      dataChannel.send(JSON.stringify(action));
    }
  }
  return result;
};

export const setDataChannel = (channel) => {
  console.log("[setDataChannel] channel", channel);
  dataChannel = channel;

  dataChannel.onopen = () => {
    console.log("Data channel is open");
  };

  dataChannel.onclose = () => {
    console.log("Data channel is closed");
  };

  dataChannel.onerror = (error) => {
    console.error("Data channel error:", error);
  };

  dataChannel.onmessage = (event) => {
    handleWebRTCMessage(store)(event);
  };
};

export const handleWebRTCMessage = (store) => (event) => {
  const action = JSON.parse(event.data);
  console.log("Received message", action);
  if (action.type.startsWith("shapes/")) {
    store.dispatch(action); // Update Redux state
  }
};

export default webrtcMiddleware;
