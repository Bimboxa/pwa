import { useSelector } from "react-redux";
import PropTypes from "prop-types";

// Zone picked for a chat « Réparation » (mapEditor.chatRepairZone, base-map
// reference pixels). Rendered inside the base-map transform group of the
// InteractionLayer, so the rectangle follows pan / zoom; the dashed frame
// stays 2 screen pixels wide whatever the zoom.
export default function ChatRepairZoneLayer({ containerK = 1 }) {
  const zone = useSelector((s) => s.mapEditor.chatRepairZone);
  if (!zone || !(zone.width > 0) || !(zone.height > 0)) return null;
  const k = containerK > 0 ? containerK : 1;
  return (
    <rect
      x={zone.x}
      y={zone.y}
      width={zone.width}
      height={zone.height}
      fill="#e91e63"
      fillOpacity={0.06}
      stroke="#e91e63"
      strokeWidth={2 / k}
      strokeDasharray={`${8 / k} ${6 / k}`}
      style={{ pointerEvents: "none" }}
    />
  );
}

ChatRepairZoneLayer.propTypes = {
  containerK: PropTypes.number,
};
