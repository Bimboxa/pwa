import PanelQrcodeReader from "Features/qrcode/components/PanelQrcodeReader";

export default function FieldQrcodeVariantMobile({value, onChange}) {
  return <PanelQrcodeReader onScan={onChange} />;
}
