import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import Panel from "Features/layout/components/Panel";
import QrCodeReader from "./QrCodeReader";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function PanelQrcodeReader({title, onClose, onScan}) {
  // strings

  const deleteS = "Supprimer le qrcode";

  // helpers

  const showHeader = Boolean(title || onClose);

  // handlers

  function handleDelete() {
    onScan("");
  }
  return (
    <Panel>
      <BoxFlexVStretch>
        {showHeader && <HeaderTitleClose title={title} onClose={onClose} />}
        <BoxFlexVStretch>
          <QrCodeReader onScan={onScan} />
        </BoxFlexVStretch>
        <ButtonInPanel label={deleteS} onClick={handleDelete} />
      </BoxFlexVStretch>
    </Panel>
  );
}
