import store from "./store";

const broadcastChannel = new BroadcastChannel("redux-sync");

const syncTabsMiddleware = (store) => (next) => (action) => {
  const result = next(action);

  if (!action.meta?.fromBroadcast) {
    broadcastChannel.postMessage(action);
  }

  return result;
};

// listen for messages from other tabs

broadcastChannel.onmessage = (event) => {
  const action = event.data;
  console.log("[broadcastChannel]", action);
  if (
    action.type.startsWith("markers/") ||
    action.type.startsWith("shapes/") ||
    action.type.startsWith("maps/")
  ) {
    store.dispatch({...action, meta: {fromBroadcast: true}}); // Prevent rebroadcast
  }
};
export default syncTabsMiddleware;
