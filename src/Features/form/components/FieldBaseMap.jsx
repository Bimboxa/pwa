import ListBaseMapsVariantGrid from "Features/baseMaps/components/ListBaseMapsVariantGrid";

export default function FieldBaseMap({
  value,
  onChange,
  baseMaps,
  label,
  formContainerRef,
}) {
  return <ListBaseMapsVariantGrid baseMaps={baseMaps} />;
}
