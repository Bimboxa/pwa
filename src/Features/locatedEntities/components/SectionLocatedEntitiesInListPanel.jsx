import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderListPanel from "Features/listPanel/components/HeaderListPanel";

import SectionLocatedEntitiesInListPanelTabs from "./SectionLocatedEntitiesInListPanelTabs";
import SectionLocatedEntitiesInListPanelTabAnnotationTemplates from "./SectionLocatedEntitiesInListPanelTabAnnotationTemplates";
import SectionLocatedEntitiesInListPanelTabEntities from "./SectionLocatedEntitiesInListPanelTabEntities";

export default function SectionLocatedEntitiesInListPanel() {
  const title = "Annotations";

  // data

  const tab = useSelector((s) => s.locatedEntities.selectedTabInLeftPanel);

  return (
    <BoxFlexVStretch>
      <SectionLocatedEntitiesInListPanelTabs />
      {tab === "ANNOTATION_TEMPLATES" && (
        <SectionLocatedEntitiesInListPanelTabAnnotationTemplates />
      )}
      {tab === "ENTITIES" && <SectionLocatedEntitiesInListPanelTabEntities />}
    </BoxFlexVStretch>
  );
}
