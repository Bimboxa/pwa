import {
  isInSyncGroup,
  shouldReceive,
  getCurrentPathname,
} from "Features/layout/utils/isEffectivelyCoupled";

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
  TAKE_OVER: "TAKE_OVER",
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

// "In sync group" — broadcast in HELLO and used by the widest-tab decision.
// Either a leader or follower with project/scope counts; tabs on /dashboard
// or without project/scope do not.
function getLocalInSyncGroup() {
  if (!getStoreRef) return false;
  try {
    return isInSyncGroup(getStoreRef().getState(), getCurrentPathname());
  } catch {
    return false;
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
    inSyncGroup: getLocalInSyncGroup(),
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
        inSyncGroup: Boolean(msg.inSyncGroup),
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
      // A tab in the sync group answers with its current state so a fresh
      // tab can adopt project/scope/baseMap/selection without the user
      // having to act.
      if (!getLocalInSyncGroup()) break;
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
    case KIND.TAKE_OVER: {
      // Another tab just turned its switch ON. We yield: if our raw flag is
      // currently true, dispatch it to false. The dispatch is local-only
      // (the layout/setCoupledNavigationEnabled action is not in the
      // synced whitelist), so it won't bounce back.
      const store = getStoreRef?.();
      if (!store) break;
      const localRaw = store.getState().layout?.coupledNavigationEnabled;
      if (localRaw) {
        store.dispatch({
          type: "layout/setCoupledNavigationEnabled",
          payload: false,
        });
      }
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

  // Subscribe to store: re-broadcast HELLO when sync-group membership
  // flips, and broadcast TAKE_OVER when the switch flips on (the local tab
  // becomes the follower) so any other follower yields the role.
  let lastInSyncGroup = getLocalInSyncGroup();
  let lastRaw = Boolean(
    getStoreRef?.().getState().layout?.coupledNavigationEnabled
  );
  if (getStoreRef) {
    try {
      getStoreRef().subscribe(() => {
        const state = getStoreRef().getState();
        const nextRaw = Boolean(state.layout?.coupledNavigationEnabled);
        if (nextRaw && !lastRaw) {
          channel.postMessage({
            kind: KIND.TAKE_OVER,
            tabId: LOCAL_TAB_ID,
            timestamp: Date.now(),
          });
        }
        lastRaw = nextRaw;

        const nextInSyncGroup = getLocalInSyncGroup();
        if (nextInSyncGroup !== lastInSyncGroup) {
          lastInSyncGroup = nextInSyncGroup;
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
