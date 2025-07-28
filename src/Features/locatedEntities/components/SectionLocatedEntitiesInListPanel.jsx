import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "Features/listPanel/components/HeaderListPanel";

export default function SectionLocatedEntitiesInListPanel() {
  const title = "Annotations";

  return (
    <BoxFlexVStretch>
      <HeaderListPanel title={title} />
    </BoxFlexVStretch>
  );
}
