import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import FormGeneric from "Features/form/components/FormGeneric";

export default function FormListing({listing, onChange}) {
  // data
  const appConfig = useAppConfig();

  // helpers - tables
  const tableOptions = Object.entries(appConfig?.tables || {}).map(
    ([key, report]) => ({
      key,
      label: report.name,
    })
  );

  // helpers - template
  const template = {
    fields: [
      {
        key: "name",
        type: "text",
        label: "Nom",
      },
      {
        key: "mainTable",
        type: "option",
        label: "Table principale",
        valueOptions: tableOptions,
      },
    ],
  };

  // helper - item

  const item = {...listing};
  const mainTable = appConfig.tables?.[listing?.mainTableKey];
  item.mainTable = {key: listing?.mainTableKey, label: mainTable?.name};

  // handlers

  function handleItemChange(item) {
    const newListing = {
      ...listing,
      ...item,
    };
    // update props
    newListing.mainTableKey = newListing.mainTable?.key;

    // delete props
    delete newListing.mainTable;
    //
    onChange(newListing);
  }

  // render
  return (
    <FormGeneric
      template={template}
      item={item}
      onItemChange={handleItemChange}
    />
  );
}
