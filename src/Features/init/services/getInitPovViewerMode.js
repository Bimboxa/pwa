export default function getInitPovViewerMode() {
  const viewerMode = localStorage.getItem("initPovViewerMode");

  return viewerMode === "THREED" ? "THREED" : "MAP";
}
