import {useSelector} from "react-redux";

export default function isMobile() {
  const deviceType = useSelector((state) => state.layout.deviceType);
  return deviceType === "MOBILE";
}
