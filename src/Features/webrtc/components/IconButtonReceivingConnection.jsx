import {Cast as Receiving} from "@mui/icons-material";

import IconButtonPopper from "Features/layout/components/IconButtonPopper";
import BlockReceivingOffer from "./BlockReceivingOffer";

export default function IconButtonReceivingConnection() {
  const icon = <Receiving />;

  return (
    <IconButtonPopper icon={icon} keepOpen={true}>
      <BlockReceivingOffer />
    </IconButtonPopper>
  );
}
