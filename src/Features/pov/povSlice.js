import { createSlice } from "@reduxjs/toolkit";

import {
  loadPovEnhancePromptsFromLocalStorage,
  storePovEnhancePromptsInLocalStorage,
} from "./services/povEnhancePromptLocalStorage";

const povInitialState = {
  viewerMode: "MAP", // "MAP" | "THREED" — editor shown inside the POINT_OF_VIEW viewer
  // Description typed in the "Nouveau point de vue" panel before the view
  // exists; consumed (then cleared) by the next "Créer une vue".
  draftDescription: "",
  // "Amélioration IA": when on, "Créer une vue" also sends the capture to the
  // image-transformation endpoint (usedByPov prompt) and shows the result in
  // a comparison dialog.
  aiEnhanceEnabled: false,
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
    setPovDraftDescription: (state, action) => {
      state.draftDescription = action.payload ?? "";
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
  setPovDraftDescription,
  setPovAiEnhanceEnabled,
  setPovAiEnhancePrompt,
} = povSlice.actions;

export default povSlice.reducer;
