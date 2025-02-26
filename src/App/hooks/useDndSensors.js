import {useSelector} from "react-redux";
import {TouchSensor, PointerSensor, useSensor, useSensors} from "@dnd-kit/core";

export default function useDndSensors() {
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {delay: 0, tolerance: 5},
  });

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {delay: 250, tolerance: 5},
  });

  const mobileSensors = useSensors(touchSensor);
  const desktopSensors = useSensors(pointerSensor);

  const deviceType = useSelector((s) => s.layout.deviceType);

  const sensors = deviceType === "MOBILE" ? mobileSensors : desktopSensors;
  return sensors;
}
