export default function fromMapPropsToImageProps(mapProps) {
  const imageProps = {
    id: mapProps.id,
    url: mapProps.imageUrl,
    width: mapProps.imageWidth,
    height: mapProps.imageHeight,
    nodeType: "MAP",
  };
  return imageProps;
}
