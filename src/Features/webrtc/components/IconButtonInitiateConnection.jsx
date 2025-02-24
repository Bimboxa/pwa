import {QrCode} from "@mui/icons-material";

import IconButtonPopper from "Features/layout/components/IconButtonPopper";
import ButtonSendOffer from "./ButtonSendOffer";
//import BlockInitiateConnection from "./BlockInitiateConnection";

export default function IconButtonInitiateConnection() {
  const icon = <QrCode />;

  return (
    <IconButtonPopper icon={icon} keepOpen={true}>
      {/* <BlockInitiateConnection /> */}
      <ButtonSendOffer />
    </IconButtonPopper>
  );
}
