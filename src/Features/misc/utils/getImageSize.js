export default function getImageSizeAsync({file, fileURL}) {
  // inputs : either the file or the url
  const imageURL = fileURL ? fileURL : URL.createObjectURL(file);
  const image = new Image();
  const size = {};
  return new Promise((resolve, reject) => {
    image.addEventListener("load", function () {
      size.width = this.naturalWidth;
      size.height = this.naturalHeight;
      resolve(size);
    });
    image.src = imageURL;
  });
}
