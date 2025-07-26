export default function fromMapPropsToImageProps(mapProps) {
  const imageProps = {
    id: mapProps.id,
    url: mapProps.imageProps.imageUrlClient,
    width: mapProps.imageProps.imageWidth,
    height: mapProps.imageProps.imageHeight,
    nodeType: "MAP",
  };
  return imageProps;
}
