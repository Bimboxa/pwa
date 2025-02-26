import createMarkerNode from "./utilsMarkersManager/createMarkerNode";

export default class MarkersManager {
  constructor({mapEditor}) {
    this.mapEditor = mapEditor;

    this.stage = mapEditor.stage;

    this.markersById = {};
    this.markersNodesById = {};
  }

  deleteAllMarkersNodes() {
    this.mapEditor.layerMarkers.destroyChildren();
    //
    this.markersNodesById = {};
    this.markersById = {};
    //
    this.mapEditor.layerMarkers.batchDraw();
  }

  createMarkersNodes(markers) {
    markers.forEach((marker) => {
      const node = createMarkerNode({
        marker,
        stageScale: this.stage.scaleX(),
        imageNode: this.mapEditor.imagesManager.mainImageNode,
      });

      this.mapEditor.layerMarkers.add(node);
      this.markersNodesById[marker.id] = node;
    });
    this.mapEditor.layerMarkers.batchDraw();
  }

  resizeMarkersNodes() {
    const stageScale = this.stage.scaleX();
    Object.values(this.markersNodesById).forEach((node) => {
      node.radius(16 / stageScale);
    });
    this.mapEditor.layerMarkers.batchDraw();
  }
}
