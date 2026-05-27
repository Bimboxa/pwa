import { createSlice, nanoid } from "@reduxjs/toolkit";

const chronoSlice = createSlice({
  name: "chrono",
  initialState: {
    visible: false,
    position: null, // { x, y } once set (defaulted to bottom-right on first show)
    minimized: false,
    creating: false,
    activeStep: null, // { id, name, startedAt }
    steps: [], // [{ id, name, durationMs }]
  },
  reducers: {
    setChronoVisible(state, action) {
      state.visible = action.payload;
    },
    toggleChronoVisible(state) {
      state.visible = !state.visible;
    },
    setChronoPosition(state, action) {
      state.position = action.payload;
    },
    setChronoMinimized(state, action) {
      state.minimized = action.payload;
    },
    toggleChronoMinimized(state) {
      state.minimized = !state.minimized;
    },
    openChronoCreate(state) {
      state.creating = true;
    },
    closeChronoCreate(state) {
      state.creating = false;
    },
    startChronoStep: {
      reducer(state, action) {
        const { id, name, description, startedAt } = action.payload;
        if (state.activeStep) {
          state.steps.push({
            id: state.activeStep.id,
            name: state.activeStep.name,
            description: state.activeStep.description,
            durationMs: startedAt - state.activeStep.startedAt,
          });
        }
        state.activeStep = { id, name, description, startedAt };
        state.creating = false;
      },
      prepare(input) {
        const { name, description } =
          typeof input === "string" ? { name: input } : input ?? {};
        return {
          payload: {
            id: nanoid(),
            name: (name ?? "").trim() || "Étape sans nom",
            description: (description ?? "").trim() || null,
            startedAt: Date.now(),
          },
        };
      },
    },
    stopChronoStep: {
      reducer(state, action) {
        if (!state.activeStep) return;
        const stoppedAt = action.payload;
        state.steps.push({
          id: state.activeStep.id,
          name: state.activeStep.name,
          description: state.activeStep.description,
          durationMs: stoppedAt - state.activeStep.startedAt,
        });
        state.activeStep = null;
      },
      prepare() {
        return { payload: Date.now() };
      },
    },
    resetChrono(state) {
      state.activeStep = null;
      state.steps = [];
      state.creating = false;
    },
  },
});

export const {
  setChronoVisible,
  toggleChronoVisible,
  setChronoPosition,
  setChronoMinimized,
  toggleChronoMinimized,
  openChronoCreate,
  closeChronoCreate,
  startChronoStep,
  stopChronoStep,
  resetChrono,
} = chronoSlice.actions;

export default chronoSlice.reducer;
