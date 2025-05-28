import Konva from "konva";
import getMousePositionInStage from "../utils/getMousePositionInStage";

export default class Freeline {
  constructor({mapEditor}) {
    this.stage = mapEditor.stage;
    this.layer = mapEditor.layerFreeline;
    this.isDrawing = false;
    this.currentLine = null;

    // Lier les méthodes une seule fois
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
  }

  startDrawing() {
    // Stopper les handlers précédents si encore actifs
    this.stopDrawing();

    this.stage.draggable(false);

    this.stage.on("pointerdown", this.handlePointerDown);
    this.stage.on("pointermove", this.handlePointerMove);
    this.stage.on("pointerup", this.handlePointerUp);
  }

  stopDrawing() {
    this.stage.off("pointerdown", this.handlePointerDown);
    this.stage.off("pointermove", this.handlePointerMove);
    this.stage.off("pointerup", this.handlePointerUp);
    this.isDrawing = false;
    this.currentLine = null;
    this.stage.draggable(false);
  }

  handlePointerDown(e) {
    // debug
    this.currentLine = new Konva.Line({
      stroke: "red",
      strokeWidth: 4,
      points: [100, 100, 200, 200], // Ligne statique test
      lineCap: "round",
      lineJoin: "round",
    });
    this.layer.add(this.currentLine);
    this.layer.draw();
    //
    const pos = getMousePositionInStage(this.stage);
    if (!pos) return;

    this.isDrawing = true;

    this.currentLine = new Konva.Line({
      stroke: "black",
      strokeWidth: 2,
      points: [pos.x, pos.y],
      lineCap: "round",
      lineJoin: "round",
      tension: 0,
      globalCompositeOperation: "source-over",
    });

    this.layer.add(this.currentLine);
    this.layer.draw();
  }

  handlePointerMove(e) {
    if (!this.isDrawing || !this.currentLine) return;

    const pos = getMousePositionInStage(this.stage);
    if (!pos) return;

    const newPoints = this.currentLine.points().concat([pos.x, pos.y]);
    console.log("newPoints", newPoints);
    this.currentLine.points(newPoints);
    this.layer.batchDraw();
  }

  handlePointerUp(e) {
    // disable stage
    this.stage.draggable(true);
    //
    this.isDrawing = false;
    this.currentLine = null;
  }
}
