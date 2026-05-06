const CHANNEL_NAME = "tabs-registry";
const HEARTBEAT_INTERVAL_MS = 2000;
const PEER_EXPIRY_MS = 5000;
const RESIZE_DEBOUNCE_MS = 200;
const SNAPSHOT_REQUEST_WINDOW_MS = 500;

const KIND = {
  HELLO: "HELLO",
  LEAVE: "LEAVE",
  SNAPSHOT_REQUEST: "SNAPSHOT_REQUEST",
  SNAPSHOT_RESPONSE: "SNAPSHOT_RESPONSE",
};

export const LOCAL_TAB_ID =
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const channel = new BroadcastChannel(CHANNEL_NAME);
const peers = new Map(); // tabId -> { tabId, innerWidth, coupledEnabled, lastSeen }
const peerListeners = new Set();
let peersVersion = 0;

let started = false;
let getStoreRef = null;
let snapshotResponseHandled = false;
let snapshotResponseTimer = null;

function notifyPeerListeners() {
  peersVersion += 1;
  for (const l of peerListeners) {
    try {
      l();
    } catch {
      // ignore
    }
  }
}

function pruneStalePeers() {
  const now = Date.now();
  let changed = false;
  for (const [tabId, peer] of peers) {
    if (now - peer.lastSeen > PEER_EXPIRY_MS) {
      peers.delete(tabId);
      changed = true;
    }
  }
  if (changed) notifyPeerListeners();
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function getLocalCoupledEnabled() {
  if (!getStoreRef) return true;
  try {
    return Boolean(getStoreRef().getState().layout?.coupledNavigationEnabled);
  } catch {
    return true;
  }
}

function getLocalInnerWidth() {
  return typeof window !== "undefined" ? window.innerWidth : 0;
}

function broadcastHello() {
  channel.postMessage({
    kind: KIND.HELLO,
    tabId: LOCAL_TAB_ID,
    timestamp: Date.now(),
    innerWidth: getLocalInnerWidth(),
    coupledEnabled: getLocalCoupledEnabled(),
  });
}

function broadcastLeave() {
  channel.postMessage({
    kind: KIND.LEAVE,
    tabId: LOCAL_TAB_ID,
    timestamp: Date.now(),
  });
}

function buildSnapshotFromStore() {
  if (!getStoreRef) return null;
  const state = getStoreRef().getState();
  return {
    selectedProjectId: state.projects?.selectedProjectId ?? null,
    selectedScopeId: state.scopes?.selectedScopeId ?? null,
    selectedBaseMapId: state.mapEditor?.selectedBaseMapId ?? null,
    selectedBaseMapViewId: state.baseMapViews?.selectedBaseMapViewId ?? null,
    selectedBaseMapViewIdInEditor:
      state.baseMapViews?.selectedBaseMapViewIdInEditor ?? null,
    selectedItems: state.selection?.selectedItems ?? [],
    selectedPointIds: state.selection?.selectedPointIds ?? [],
  };
}

function applySnapshot(snapshot) {
  if (!getStoreRef || !snapshot) return;
  const store = getStoreRef();
  const meta = { fromBroadcast: true };

  // Apply order: project -> scope -> baseMap -> baseMapView -> selection
  if (snapshot.selectedProjectId !== undefined) {
    store.dispatch({
      type: "projects/setSelectedProjectId",
      payload: snapshot.selectedProjectId,
      meta,
    });
  }
  if (snapshot.selectedScopeId !== undefined) {
    store.dispatch({
      type: "scopes/setSelectedScopeId",
      payload: snapshot.selectedScopeId,
      meta,
    });
  }
  if (snapshot.selectedBaseMapId !== undefined) {
    store.dispatch({
      type: "mapEditors/setSelectedMainBaseMapId",
      payload: snapshot.selectedBaseMapId,
      meta,
    });
  }
  if (snapshot.selectedBaseMapViewId !== undefined) {
    store.dispatch({
      type: "baseMapViews/setSelectedBaseMapViewId",
      payload: snapshot.selectedBaseMapViewId,
      meta,
    });
  }
  if (snapshot.selectedBaseMapViewIdInEditor !== undefined) {
    store.dispatch({
      type: "baseMapViews/setSelectedBaseMapViewIdInEditor",
      payload: snapshot.selectedBaseMapViewIdInEditor,
      meta,
    });
  }
  if (Array.isArray(snapshot.selectedItems)) {
    store.dispatch({
      type: "selection/setSelectedItems",
      payload: snapshot.selectedItems,
      meta,
    });
  }
  if (Array.isArray(snapshot.selectedPointIds)) {
    store.dispatch({
      type: "selection/setSelectedPointIds",
      payload: snapshot.selectedPointIds,
      meta,
    });
  }
}

channel.onmessage = (event) => {
  const msg = event?.data;
  if (!msg || msg.tabId === LOCAL_TAB_ID) return;

  switch (msg.kind) {
    case KIND.HELLO: {
      peers.set(msg.tabId, {
        tabId: msg.tabId,
        innerWidth: Number(msg.innerWidth) || 0,
        coupledEnabled: Boolean(msg.coupledEnabled),
        lastSeen: Date.now(),
      });
      notifyPeerListeners();
      break;
    }
    case KIND.LEAVE: {
      if (peers.delete(msg.tabId)) notifyPeerListeners();
      break;
    }
    case KIND.SNAPSHOT_REQUEST: {
      // Only coupled tabs respond.
      if (!getLocalCoupledEnabled()) break;
      const snapshot = buildSnapshotFromStore();
      if (!snapshot) break;
      channel.postMessage({
        kind: KIND.SNAPSHOT_RESPONSE,
        tabId: LOCAL_TAB_ID,
        timestamp: Date.now(),
        targetTabId: msg.tabId,
        snapshot,
      });
      break;
    }
    case KIND.SNAPSHOT_RESPONSE: {
      if (msg.targetTabId !== LOCAL_TAB_ID) break;
      if (snapshotResponseHandled) break;
      snapshotResponseHandled = true;
      if (snapshotResponseTimer) {
        clearTimeout(snapshotResponseTimer);
        snapshotResponseTimer = null;
      }
      applySnapshot(msg.snapshot);
      break;
    }
    default:
      break;
  }
};

export function startTabsRegistry(getStore) {
  if (started) return;
  started = true;
  getStoreRef = getStore;

  // Heartbeat
  setInterval(() => {
    pruneStalePeers();
    broadcastHello();
  }, HEARTBEAT_INTERVAL_MS);

  // Resize -> debounced HELLO
  if (typeof window !== "undefined") {
    const onResize = debounce(broadcastHello, RESIZE_DEBOUNCE_MS);
    window.addEventListener("resize", onResize);
    window.addEventListener("beforeunload", broadcastLeave);
  }

  // Subscribe to store: re-broadcast when local coupling flips.
  let lastCoupled = getLocalCoupledEnabled();
  if (getStoreRef) {
    try {
      getStoreRef().subscribe(() => {
        const next = getLocalCoupledEnabled();
        if (next !== lastCoupled) {
          lastCoupled = next;
          broadcastHello();
        }
      });
    } catch {
      // ignore
    }
  }

  // Initial HELLO + snapshot request.
  broadcastHello();
  requestSnapshot();
}

export function getPeers() {
  return peers;
}

export function getPeersVersion() {
  return peersVersion;
}

export function subscribePeers(listener) {
  peerListeners.add(listener);
  return () => peerListeners.delete(listener);
}

export function requestSnapshot() {
  snapshotResponseHandled = false;
  channel.postMessage({
    kind: KIND.SNAPSHOT_REQUEST,
    tabId: LOCAL_TAB_ID,
    timestamp: Date.now(),
  });
  if (snapshotResponseTimer) clearTimeout(snapshotResponseTimer);
  snapshotResponseTimer = setTimeout(() => {
    snapshotResponseHandled = true;
    snapshotResponseTimer = null;
  }, SNAPSHOT_REQUEST_WINDOW_MS);
}
