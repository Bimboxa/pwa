import { useSelector } from "react-redux";

import TopBarMobile from "./TopBarMobile";
import TopBarDesktop from "./TopBarDesktop";

export default function TopBar() {
  const deviceType = useSelector((s) => s.layout.deviceType);
  const isFullScreen = useSelector((s) => s.layout.isFullScreen);

  if (isFullScreen) return null;

  return (
    <>
      {deviceType === "MOBILE" && <TopBarMobile />}
      {deviceType !== "MOBILE" && <TopBarDesktop />}
    </>
  );
}
