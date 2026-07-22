import { createSlice } from "@reduxjs/toolkit";

import {
  loadPovEnhancePromptsFromLocalStorage,
  storePovEnhancePromptsInLocalStorage,
} from "./services/povEnhancePromptLocalStorage";

const povInitialState = {
  viewerMode: "MAP", // "MAP" | "THREED" — editor shown inside the POINT_OF_VIEW viewer
  // The capture frame is only armed while a view is being created / updated:
  // otherwise the POV module behaves like the regular editor (PopperMapListings
  // visible, editing free) so the user can filter before framing.
  framingActive: false,
  // Description typed in the "Nouveau point de vue" panel before the view
  // exists; consumed (then cleared) by the next "Créer une vue".
  draftDescription: "",
  // Title banner text forced by a batch capture (video generation), which
  // renders each POV in turn WITHOUT touching the selection — the banner would
  // otherwise show the selected POV's description on every frame. null = the
  // banner follows the selection / draft as usual (see usePovTitleText).
  captureTitleOverride: null,
  // "Amélioration IA": when on, "Créer une vue" also sends the capture to the
  // image-transformation endpoint (usedByPov prompt) and shows the result in
  // a comparison dialog.
  aiEnhanceEnabled: false,
  // Restored view freeze: {povId, createdBefore} | null. A restored POV shows
  // its content AS OF its generation date — annotations created later are
  // filtered out of every useAnnotationsV2 read while the POV viewer is
  // displayed (see selectPovFreezeCreatedBefore).
  viewFreeze: null,
  // User edits of the "Amélioration IA" prompt, {[promptId]: text}. Loaded
  // from / persisted to localStorage; an entry only exists while the user
  // has customized the org's default prompt.
  aiEnhancePromptById: loadPovEnhancePromptsFromLocalStorage(),
};

export const povSlice = createSlice({
  name: "pov",
  initialState: povInitialState,
  reducers: {
    setPovViewerMode: (state, action) => {
      state.viewerMode = action.payload;
    },
    setPovFramingActive: (state, action) => {
      state.framingActive = Boolean(action.payload);
    },
    setPovDraftDescription: (state, action) => {
      state.draftDescription = action.payload ?? "";
    },
    // string to force the banner text, null to release it
    setPovCaptureTitleOverride: (state, action) => {
      state.captureTitleOverride = action.payload ?? null;
    },
    // {povId, createdBefore} | null
    setPovViewFreeze: (state, action) => {
      state.viewFreeze = action.payload ?? null;
    },
    setPovAiEnhanceEnabled: (state, action) => {
      state.aiEnhanceEnabled = Boolean(action.payload);
    },
    // {promptId, prompt}: a null / empty prompt removes the override and
    // restores the org's default prompt.
    setPovAiEnhancePrompt: (state, action) => {
      const { promptId, prompt } = action.payload ?? {};
      if (!promptId) return;
      if (prompt) {
        state.aiEnhancePromptById[promptId] = prompt;
      } else {
        delete state.aiEnhancePromptById[promptId];
      }
      storePovEnhancePromptsInLocalStorage(state.aiEnhancePromptById);
    },
  },
});

export const {
  setPovViewerMode,
  setPovFramingActive,
  setPovDraftDescription,
  setPovCaptureTitleOverride,
  setPovViewFreeze,
  setPovAiEnhanceEnabled,
  setPovAiEnhancePrompt,
} = povSlice.actions;

export default povSlice.reducer;
