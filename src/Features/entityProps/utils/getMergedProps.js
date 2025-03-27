export default function getMergedProps(entitiesWithProps) {
  const mergedProps = {};
  entitiesWithProps.forEach((entity) => {
    const props = entity.props;
    if (props) {
      Object.keys(props).forEach((key) => {
        if (!mergedProps[key]) {
          mergedProps[key] = props[key];
        }
      });
    }
  });
  return mergedProps;
}
