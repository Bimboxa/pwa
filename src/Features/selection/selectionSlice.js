import { createSlice } from "@reduxjs/toolkit";

const selectionInitialState = {
  selectedItems: [], // Array of { id, nodeId, type, nodeType, listingId, context, pointId, partId, partType }
  openDialogDeleteSelectedItem: false,
};

export const selectionSlice = createSlice({
  name: "selection",
  initialState: selectionInitialState,
  reducers: {
    setSelectedItem: (state, action) => {
      // Handles singular selection (clears others)
      // Payload: { id, nodeId, type, nodeType, listingId, context, partId, partType }
      const item = action.payload;
      if (!item) {
        state.selectedItems = [];
      } else {
        state.selectedItems = [item];
      }
    },
    setSelectedItems: (state, action) => {
      // Handles setting items directly
      state.selectedItems = action.payload || [];
    },
    toggleItemSelection: (state, action) => {
      const item = action.payload;
      const index = state.selectedItems.findIndex((i) => i.id === item.id);
      if (index >= 0) {
        state.selectedItems.splice(index, 1);
      } else {
        state.selectedItems.push(item);
      }
    },
    addSelectedItem: (state, action) => {
      const item = action.payload;
      if (!state.selectedItems.find(i => i.id === item.id)) {
        state.selectedItems.push(item);
      }
    },
    removeSelectedItem: (state, action) => {
      const id = action.payload;
      state.selectedItems = state.selectedItems.filter(i => i.id !== id);
    },
    // Updates the sub-selection (part/point) for a specific item (or the single selected item)
    setSubSelection: (state, action) => {
      const { id, pointId, partId, partType } = action.payload;
      // If we provided an id, find it. If not, assume the first/single item
      let item = null;
      if (id) {
        item = state.selectedItems.find(i => i.id === id);
      } else if (state.selectedItems.length === 1) {
        item = state.selectedItems[0];
      }

      if (item) {
        // If we set a point, we update pointId. 
        // If we set a part, we update partId.
        // We accept null to clear them.
        if (pointId !== undefined) item.pointId = pointId;
        if (partId !== undefined) item.partId = partId;
        if (partType !== undefined) item.partType = partType;
      }
    },
    setOpenDialogDeleteSelectedItem: (state, action) => {
      state.openDialogDeleteSelectedItem = action.payload;
    },
    setOpenDialogDeleteSelectedAnnotation: (state, action) => {
      state.openDialogDeleteSelectedItem = action.payload;
    },
    clearSelection: (state) => {
      state.selectedItems = [];
    },
    triggerSelectionBack: (state) => {
      const item = state.selectedItems[0];
      if (item) {
        if (item.type === "ANNOTATION_TEMPLATE") {
          item.type = "LISTING";
          item.id = item.listingId;
        }
      }
    }
  },
});

export const {
  setSelectedItem,
  setSelectedItems,
  toggleItemSelection,
  addSelectedItem,
  removeSelectedItem,
  setSubSelection,
  setOpenDialogDeleteSelectedItem,
  setOpenDialogDeleteSelectedAnnotation,
  clearSelection,
  triggerSelectionBack
} = selectionSlice.actions;

// Selectors
export const selectSelectedItems = (state) => state.selection.selectedItems;

// Helper to get the first selected item (legacy support)
export const selectSelectedItem = (state) => state.selection.selectedItems[0] || null;

// Helper for UI parts that need point ID
export const selectSelectedPointId = (state) => {
  // Returns the pointId of the first item that has one
  const item = state.selection.selectedItems.find(i => i.pointId);
  return item ? item.pointId : null;
};
// Helper for UI parts that need part ID
export const selectSelectedPartId = (state) => {
  const item = state.selection.selectedItems.find(i => i.partId);
  return item ? item.partId : null;
};

export default selectionSlice.reducer;
