import {TextureLoader} from "three";

export default function getTextureAsync(url) {
  return new Promise((resolve) => {
    new TextureLoader().load(url, (texture) => {
      resolve(texture);
    });
  });
}
