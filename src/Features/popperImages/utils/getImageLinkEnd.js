import {
  IMAGE_BADGE_HEIGHT_PX,
  IMAGE_BADGE_WIDTH_PX,
} from "../constants/imageDisplay.js";

// End of a tile → anchor leader, in screen px. Off in situ with "Numéro"
// the anchor is a numbered badge centred on it (`withBadge`): the leader
// stops on the badge border instead of crossing its face. Without badge (or
// when `from` is inside it) the end is the anchor itself.
export default function getImageLinkEnd(from, anchor, withBadge) {
  if (!withBadge) return { x: anchor.x, y: anchor.y };
  const dx = from.x - anchor.x;
  const dy = from.y - anchor.y;
  const hw = IMAGE_BADGE_WIDTH_PX / 2;
  const hh = IMAGE_BADGE_HEIGHT_PX / 2;
  const t = Math.min(
    dx !== 0 ? hw / Math.abs(dx) : Infinity,
    dy !== 0 ? hh / Math.abs(dy) : Infinity
  );
  if (!Number.isFinite(t) || t >= 1) return { x: anchor.x, y: anchor.y };
  return { x: anchor.x + dx * t, y: anchor.y + dy * t };
}
