// Brief white screen flash, used as visual feedback after a procedure runs.
export default function fireFlash() {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    background: "white",
    opacity: "0.6",
    zIndex: "9999",
    pointerEvents: "none",
    transition: "opacity 0.4s ease-out",
  });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = "0";
  });
  overlay.addEventListener("transitionend", () => overlay.remove());
}
