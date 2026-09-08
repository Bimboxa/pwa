import { nanoid } from "nanoid";

// Krnet "listes d'état" (state_models + listing_state_models) embedded on
// the Bimboxa listing under `listing.notesApp.stateModels`. Ports of the
// mobile app's src/utils/stateModelUtils.js and of the ConfigStateModel /
// ConfigState screens' rules. Pure module (replayable in node).
//
// Conventions (Krnet):
// - settings.initialStateId: id of the initial state; null = none. When the
//   KEY is absent (legacy models) the first state is the initial one.
// - settings.freeTransitions: default TRUE when absent.
// - settings.isPrimary: the model shown on list rows, exclusive among the
//   siblings; fallback = first model.

export const COLOR_OPTIONS = ["red", "blue", "green", "orange", "purple"];
export const COLOR_LABELS = {
  red: "Rouge",
  blue: "Bleu",
  green: "Vert",
  orange: "Orange",
  purple: "Violet",
};
// UI-only hex values (Krnet theme tokens are not shared).
export const COLOR_HEX = {
  red: "#d32f2f",
  blue: "#1976d2",
  green: "#2e7d32",
  orange: "#ed6c02",
  purple: "#7b1fa2",
};

export function getStateModels(listing, { includeDeleted = false } = {}) {
  const sms = listing?.notesApp?.stateModels;
  if (!Array.isArray(sms)) return [];
  return includeDeleted ? sms : sms.filter((sm) => sm && !sm.deletedAt);
}

export function getStates(sm) {
  return Array.isArray(sm?.states) ? sm.states : [];
}

export function getStateModelSettings(sm) {
  return sm?.settings && typeof sm.settings === "object" ? sm.settings : {};
}

export function getInitialStateId(sm) {
  const settings = getStateModelSettings(sm);
  if (Object.prototype.hasOwnProperty.call(settings, "initialStateId")) {
    return settings.initialStateId; // may be null (= no initial state)
  }
  const states = getStates(sm);
  return states.length > 0 ? states[0].id : null;
}

export function hasFreeTransitions(sm) {
  return getStateModelSettings(sm).freeTransitions !== false;
}

export function getPrimaryStateModel(stateModels) {
  if (!stateModels || stateModels.length === 0) return null;
  const explicit = stateModels.find(
    (sm) => getStateModelSettings(sm).isPrimary
  );
  return explicit || stateModels[0];
}

// Default model created from the field editor (Krnet handleCreateStateModel).
export function buildDefaultStateModel({ id } = {}) {
  const states = [
    { id: "new1", name: "À traiter", color: "red" },
    { id: "new2", name: "En cours", color: "blue" },
    { id: "new3", name: "Résolu", color: "green" },
  ];
  return {
    id: id ?? nanoid(),
    name: "Nouveau suivi",
    states,
    transitions: [],
    settings: { freeTransitions: true, initialStateId: states[0].id },
    visible: true,
    navName: "Nouveau suivi",
    listingStateModelId: null,
    isLocalOnly: true,
  };
}

export function buildNewState(states) {
  const n = Array.isArray(states) ? states.length : 0;
  return {
    id: nanoid(),
    name: "Nouvel état",
    color: COLOR_OPTIONS[n % COLOR_OPTIONS.length],
  };
}

export function updateState(sm, stateId, patch) {
  return {
    ...sm,
    states: getStates(sm).map((s) =>
      s.id === stateId ? { ...s, ...patch } : s
    ),
  };
}

// Prunes the transitions referencing the state; clears initialStateId only
// when it pointed at the removed state.
export function removeState(sm, stateId) {
  const states = getStates(sm).filter((s) => s.id !== stateId);
  const transitions = (Array.isArray(sm?.transitions) ? sm.transitions : [])
    .filter((t) => t.fromState !== stateId)
    .map((t) => ({
      ...t,
      toState: (t.toState || []).filter((id) => id !== stateId),
    }));
  const settings = getStateModelSettings(sm);
  const nextSettings =
    settings.initialStateId === stateId
      ? { ...settings, initialStateId: null }
      : settings;
  return { ...sm, states, transitions, settings: nextSettings };
}

export function setInitialState(sm, stateId, isInitial) {
  return {
    ...sm,
    settings: {
      ...getStateModelSettings(sm),
      initialStateId: isInitial ? stateId : null,
    },
  };
}

export function setFreeTransitions(sm, value) {
  return {
    ...sm,
    settings: { ...getStateModelSettings(sm), freeTransitions: !!value },
  };
}

// One primary model per listing: setting one clears the others.
export function setPrimary(stateModels, smId, value) {
  return (stateModels || []).map((sm) => {
    if (sm.id === smId) {
      return {
        ...sm,
        settings: { ...getStateModelSettings(sm), isPrimary: !!value },
      };
    }
    if (value && !sm.deletedAt && getStateModelSettings(sm).isPrimary) {
      return {
        ...sm,
        settings: { ...getStateModelSettings(sm), isPrimary: false },
      };
    }
    return sm;
  });
}

export function tombstoneStateModel(sm, nowIso) {
  return { ...sm, deletedAt: nowIso ?? new Date().toISOString() };
}
