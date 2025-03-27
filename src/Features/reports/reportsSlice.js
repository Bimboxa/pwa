import {createSlice} from "@reduxjs/toolkit";

const reportsInitialState = {
  //
  reportsUpdatedAt: null,
  //
  selectedReportId: null,
  newReport: null,
  isEditingReport: false,
  editedReport: null,
  //
};

export const reportsSlice = createSlice({
  name: "reports",
  initialState: reportsInitialState,
  reducers: {
    setSelectedReportId: (state, action) => {
      state.selectedReportId = action.payload;
    },
    setNewReport: (state, action) => {
      state.newReport = action.payload;
    },
    setIsEditingReport: (state, action) => {
      state.isEditingReport = action.payload;
    },
    setEditedReport: (state, action) => {
      state.editedReport = action.payload;
    },
    //
    triggerReportsUpdate: (state) => {
      state.reportsUpdatedAt = Date.now();
    },
    //
    createReport: (state, action) => {
      const report = action.payload;
      state.reportsReport[report.id] = report;
    },
    updateReport: (state, action) => {
      const updates = action.payload;
      const report = state.reportsReport[updates.id];
      state.reportsReport[updates.id] = {...report, ...updates};
    },
  },
});

export const {
  setSelectedReportId,
  triggerReportsUpdate,
  //
  setNewReport,
  setIsEditingReport,
  setEditedReport,
  //
  createReport,
  updateReport,
} = reportsSlice.actions;

export default reportsSlice.reducer;
