// Scrolls a tree row to the top of its scroll container, right under the
// sticky header of the tree (`headerEl`, whose height is deducted — a bare
// scrollIntoView would hide the row behind it).

function findScrollParent(el) {
  let node = el?.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    )
      return node;
    node = node.parentElement;
  }
  return null;
}

export default function scrollTreeRowIntoView(rowEl, headerEl) {
  if (!rowEl) return;
  const container = findScrollParent(rowEl);
  if (!container) {
    rowEl.scrollIntoView({ block: "start", behavior: "smooth" });
    return;
  }
  const top =
    rowEl.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop -
    (headerEl?.offsetHeight ?? 0);
  container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
