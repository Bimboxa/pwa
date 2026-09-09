import { createSlice } from "@reduxjs/toolkit";

import { setSelectedViewerKey } from "Features/viewers/viewersSlice";

import {
  loadPlanningPanelLayout,
  storePlanningPanelLayout,
} from "./services/planningPanelLocalStorage";
import { PANEL_DEFAULT_HEIGHT } from "./constants/planningDefaults";

const storedLayout = loadPlanningPanelLayout();

const planningInitialState = {
  // db trigger tick shared by the plannings / planningResources /
  // planningSlots tables (one dispatch per service call).
  planningUpdatedAt: null,
  // Bottom panel layout (persisted per browser). The panel is gated by the
  // PLANNING module in SectionViewer, so `panelOpen` survives module
  // switches.
  panelOpen: storedLayout.open === true,
  panelHeight: Number.isFinite(storedLayout.height)
    ? storedLayout.height
    : PANEL_DEFAULT_HEIGHT,
  // Selected block of the grid (keyboard delete target).
  selectedSlotId: null,
  // "Play" mode: the grid highlights the current step and the map renders the
  // work packages by status at that step (done / in progress / to do). Reset on
  // module switch and when the panel closes.
  playActive: false,
  playStep: 0,
};

export const planningSlice = createSlice({
  name: "planning",
  initialState: planningInitialState,
  reducers: {
    triggerPlanningUpdate: (state) => {
      state.planningUpdatedAt = Date.now();
    },
    setPanelOpen: (state, action) => {
      state.panelOpen = Boolean(action.payload);
      storePlanningPanelLayout({ open: state.panelOpen });
      if (!state.panelOpen) {
        state.playActive = false;
        state.selectedSlotId = null;
      }
    },
    // payload: {active, step?}
    setPlayActive: (state, action) => {
      const { active, step } = action.payload ?? {};
      state.playActive = Boolean(active);
      if (Number.isFinite(step)) state.playStep = Math.max(0, Math.floor(step));
    },
    setPlayStep: (state, action) => {
      state.playStep = Math.max(0, Math.floor(action.payload ?? 0));
    },
    // Live value while dragging the handle (not persisted on every move).
    setPanelHeight: (state, action) => {
      state.panelHeight = action.payload;
    },
    persistPanelHeight: (state) => {
      storePlanningPanelLayout({ height: state.panelHeight });
    },
    setSelectedSlotId: (state, action) => {
      state.selectedSlotId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(setSelectedViewerKey, (state) => {
      state.selectedSlotId = null;
      state.playActive = false;
    });
  },
});

export const {
  triggerPlanningUpdate,
  setPanelOpen,
  setPanelHeight,
  persistPanelHeight,
  setSelectedSlotId,
  setPlayActive,
  setPlayStep,
} = planningSlice.actions;

export default planningSlice.reducer;
