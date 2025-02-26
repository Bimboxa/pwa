import addShapeRowService from "Features/gapi/gapiServicesGSheetMisc/addShapeRowService";

export function createShapeService(shape) {
  // gsheet
  addShapeRowService(shape);

  // state
  return shape;
}
