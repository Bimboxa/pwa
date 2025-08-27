import { useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import HeaderListPanelSelectedItem from "Features/listPanel/components/HeaderListPanelSelectedItem";

import ImageObject from "Features/images/js/ImageObject";

import editor from "App/editor";
import ImageGeneric from "Features/images/components/ImageGeneric";

export default function SectionBaseMapViewInListPanel({ item, onClose }) {
  // string

  const testS = "Changer le gabarit d'impression";

  // state

  const [index, setIndex] = useState(0);
  const [url, setUrl] = useState(null);

  // data

  const appConfig = useAppConfig();

  // helpers

  const bgImages = appConfig?.features?.baseMapViews.bgImages;
  const nextIndex = index === bgImages?.length - 1 ? 0 : index + 1;

  // handlers

  async function handleTest() {
    const img = bgImages[nextIndex];
    const bgImage = new ImageObject({
      imageUrlRemote: img.url,
      imageSize: { width: img.width, height: img.height },
    });
    //console.log("editor", editor, bgImage.imageUrlClient);
    console.log("imageUrl", img.url);
    setUrl(img.url);
    editor.mapEditor.setBgImage(bgImage);
    setIndex(nextIndex);
  }

  return (
    <BoxFlexVStretch>
      <HeaderListPanelSelectedItem item={item} onClose={onClose} />
      <ButtonInPanel label={testS} onClick={handleTest} />
      <ImageGeneric url={url} height={"150px"} />
    </BoxFlexVStretch>
  );
}
