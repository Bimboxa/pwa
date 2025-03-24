import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

export default function BlockEntityInListPanelVariantHeader({label, onClose}) {
  return <HeaderTitleClose title={label} onClose={onClose} />;
}
