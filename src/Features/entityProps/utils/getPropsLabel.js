export default function getPropsLabel(props, entityModel) {
  const labelKey = entityModel?.labelKey;
  const prop = props[labelKey];
  //
  if (!prop) {
    return "-?-";
  }
  //
  let propsLabel = "-?-";
  if (prop.type === "text") {
    propsLabel = prop.value;
  } else if (prop.type === "option") {
    propsLabel = prop.value.label;
  }

  return propsLabel;
}
