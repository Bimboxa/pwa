import {useSelector} from "react-redux";

import SectionActionsEntityPropsVariantMulti from "./SectionActionsEntityPropsVariantMulti";
import SectionActionsEntityPropsVariantSingle from "./SectionActionsEntityPropsVariantSingle";

export default function SectionActionsEntityProps() {
  // data

  const multiSelect = useSelector((s) => s.entityProps.multiSelect);
  return multiSelect ? (
    <SectionActionsEntityPropsVariantMulti />
  ) : (
    <SectionActionsEntityPropsVariantSingle />
  );
}
