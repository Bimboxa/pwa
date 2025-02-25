import theme from "Styles/theme";
import {fill} from "three/src/extras/TextureUtils";

export default class NodeAnchorsManager {
  constructor({mapEditor, node}) {
    this.mapEditor = mapEditor;

    this.stage = mapEditor.stage;
    this.layerAnchors = mapEditor.layerAnchors;
    this.node = node;
    this.layerAnchors = this.anchorRadiusCore = 5;

    this.stageCursorMemo = null;

    this.selectedAnchorNode = null; // for deletion
    this.selectedAnchorIndex = null; // for deletion
  }

  createAnchorsNodes(node, options) {
    // options

    const stageScale = options?.stageScale ?? 1;

    // main

    if (!this.node) return null;
    const points = this.node.points;
    for (let i = 0; i < points.length; i += 2) {
      const anchorNode = new Konva.Circle({
        x: points[i],
        y: points[i + 1],
        radius: this.anchorRadiusCore / stageScale,
        fill: theme.palette.anchor.default,
        draggable: true,
      });
      anchorNode.setAttr("nodeType", "ANCHOR");

      // draw
      this.layerAnchors.add(anchorNode);

      // listeners
      anchorNode.on("mouseenter", () => {
        this.stageCursorMemo = this.stage.getContainer().style.cursor;
        this.stage.getContainer().style.cursor = "grab";
      });
      anchorNode.on("mouseleave", () => {
        this.stage.getContainer().style.cursor = this.stageCursorMemo;
      });
      anchorNode.on("click,tap", () => {
        this.selectAnchorNode(anchorNode, i / 2);
      });
    }
    // draw
    this.layerAnchors.draw();
  }

  unselectAnchorNode() {
    if (this.selectedAnchorNode) {
      this.selectedAnchorNode.fill(theme.palette.anchor.default);
      this.selectedAnchorNode = null;
      this.selectedAnchorIndex = null;
    }
  }

  selectAnchorNode(anchorNode, anchorIndex) {
    if (this.selectedAnchorNode) {
      this.unselectAnchorNode();
    }
    anchorNode.fill(theme.palette.anchor.selected);
    this.selectedAnchorNode = anchorNode;
    this.selectedAnchorIndex = anchorIndex;
  }
}
