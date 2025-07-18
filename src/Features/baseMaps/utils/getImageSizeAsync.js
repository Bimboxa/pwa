export default async function getImageSizeAsync(url) {
  const image = new Image();
  const size = {};
  return new Promise((resolve, reject) => {
    image.addEventListener("load", function () {
      size.width = this.naturalWidth;
      size.height = this.naturalHeight;
      console.log("size", size);
      resolve(size);
    });
    image.src = url;
  });
}
