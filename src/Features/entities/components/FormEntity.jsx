import useIsMobile from "Features/layout/hooks/useIsMobile";

import FormVariantMobile from "Features/form/components/FormVariantMobile";
import FormVariantGrid from "Features/form/components/FormVariantGrid";

export default function FormEntity({
  template,
  entity,
  onEntityChange,
  selectorContainerRef,
}) {
  // data

  const isMobile = useIsMobile();

  // handlers

  function handleItemChange(item) {
    onEntityChange(item);
  }

  return (
    <>
      {isMobile && (
        <FormVariantMobile
          template={template}
          item={entity}
          onItemChange={handleItemChange}
        />
      )}
      {!isMobile && (
        <FormVariantGrid
          template={template}
          item={entity}
          onItemChange={handleItemChange}
          selectorContainerRef={selectorContainerRef}
        />
      )}
    </>
  );
}
