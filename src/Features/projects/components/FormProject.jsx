import FormVariantGrid from "Features/form/components/FormVariantGrid";
import FormVariantMobile from "Features/form/components/FormVariantMobile";

import useIsMobile from "Features/layout/hooks/useIsMobile";

export default function FormProject({project, onChange}) {
  // data

  const isMobile = useIsMobile();

  // const

  const template = {
    fields: [
      {
        key: "name",
        label: "Nom",
        type: "text",
      },
      {
        key: "clientRef",
        label: "Réf.",
        type: "text",
      },
    ],
  };

  // handlers

  function handleItemChange(item) {
    onChange(item);
  }

  return (
    <>
      {isMobile && (
        <FormVariantMobile
          template={template}
          item={project}
          onItemChange={handleItemChange}
        />
      )}
      {!isMobile && (
        <FormVariantGrid
          template={template}
          item={project}
          onItemChange={handleItemChange}
        />
      )}
    </>
  );
}
