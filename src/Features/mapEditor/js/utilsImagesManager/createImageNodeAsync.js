export default function createImageNodeAsync(image) {
  // image

  const { id, url, width, height, nodeType, x, y } = image;

  // main
  const imageObj = new Image();

  return new Promise((resolve, reject) => {
    imageObj.onload = () => {
      const imageNode = new Konva.Image({
        id,
        image: imageObj,
        x,
        y,
        width: width,
        height: height,
      });

      imageNode.setAttr("nodeType", nodeType);

      resolve(imageNode);
    };
    imageObj.crossOrigin = "anonymous";
    imageObj.src = url;

    imageObj.onerror = (error) => {
      console.error("error creating Image node", error);
    };
  });
}
