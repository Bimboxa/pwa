import {useSelector} from "react-redux";

import TopBarMobile from "./TopBarMobile";
import TopBarDesktop from "./TopBarDesktop";

export default function TopBar() {
  const deviceType = useSelector((s) => s.layout.deviceType);

  return (
    <>
      {deviceType === "MOBILE" && <TopBarMobile />}
      {deviceType !== "MOBILE" && <TopBarDesktop />}
    </>
  );
}
