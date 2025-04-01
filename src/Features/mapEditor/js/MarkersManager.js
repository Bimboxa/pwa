import store from "App/store";
import db from "App/db/db";

import {setSelectedEntityId} from "Features/entities/entitiesSlice";

import createMarkerNode from "./utilsMarkersManager/createMarkerNode";
import getNodeCoordsInImage from "./utilsImagesManager/getNodeCoordsInImage";

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

      // listeners

      node.on("tap click", async () => {
        const item = await db.markers.get(marker.id);
        const currentId = store.getState().entities.selectedEntityId;
        const nextId =
          item.targetEntityId === currentId ? null : item.targetEntityId;
        if (item) store.dispatch(setSelectedEntityId(nextId));
      });

      node.on("dragend", async () => {
        const image = this.mapEditor.imagesManager.mainImageNode;
        const {x, y} = getNodeCoordsInImage(node, image);
        console.log("[MarkersManager] dragend x,y", x.toFixed(1), y.toFixed(1));
        await db.markers.update(marker.id, {x, y});
      });
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
