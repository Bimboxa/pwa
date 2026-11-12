import { createSlice } from "@reduxjs/toolkit";

const commentsInitialState = {
  // COMMENT listing displayed by the panel, the pills strip and the scene
  // pins. Null = the first comment listing of the scope.
  selectedListingId: null,
  // Comment whose content is displayed in the floating panel.
  openedCommentId: null,
  // The floating panel shows the editor (Comments module only).
  isEditing: false,
  // "+ Commentaire localisé" armed: the next click in the displayed editor
  // (2D or 3D) picks the location of the new comment.
  isLocating: false,
  openDialogCreateListing: false,
};

export const commentsSlice = createSlice({
  name: "comments",
  initialState: commentsInitialState,
  reducers: {
    setSelectedCommentListingId: (state, action) => {
      if (state.selectedListingId === (action.payload ?? null)) return;
      state.selectedListingId = action.payload ?? null;
      state.openedCommentId = null;
      state.isEditing = false;
    },
    setOpenedCommentId: (state, action) => {
      state.openedCommentId = action.payload ?? null;
      state.isEditing = false;
    },
    // Opens a comment straight in its editor (right after its creation).
    openCommentForEditing: (state, action) => {
      state.openedCommentId = action.payload ?? null;
      state.isEditing = Boolean(action.payload);
    },
    setIsEditingComment: (state, action) => {
      state.isEditing = Boolean(action.payload);
    },
    setIsLocatingComment: (state, action) => {
      state.isLocating = Boolean(action.payload);
    },
    setOpenDialogCreateCommentListing: (state, action) => {
      state.openDialogCreateListing = Boolean(action.payload);
    },
  },
});

export const {
  setSelectedCommentListingId,
  setOpenedCommentId,
  openCommentForEditing,
  setIsEditingComment,
  setIsLocatingComment,
  setOpenDialogCreateCommentListing,
} = commentsSlice.actions;

export default commentsSlice.reducer;
