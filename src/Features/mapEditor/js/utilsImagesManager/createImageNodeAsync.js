export default function createImageNodeAsync(image) {
  // image

  const { id, url, width, height, nodeType, x, y } = image;

  // main
  const imageObj = new Image();

  return new Promise((resolve, reject) => {
    imageObj.onload = () => {
      // Create a group to hold the image and its border
      const BORDER_COLOR = "#39FF14"; // Example: Stabilo Boss-like green, change as needed
      const BORDER_WIDTH = 2;

      // Create the image node
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
    imageObj.crossOrigin = "Anonymous";
    imageObj.src = url;

    imageObj.onerror = (error) => {
      reject(error);
    };
  });
}
