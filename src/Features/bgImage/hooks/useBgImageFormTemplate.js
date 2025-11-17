import useResetBaseMapPose from "Features/mapEditor/hooks/useResetBaseMapPose";
import useBgImagesFromAppConfig from "./useBgImagesFromAppConfig";

export default function useBgImageFormTemplate(bgImageItem) {
  // data

  const bgImages = useBgImagesFromAppConfig();

  const onClick = useResetBaseMapPose();

  // main

  const template = {
    fields: [
      // {
      //   key: "show",
      //   label: "Afficher",
      //   type: "check",
      // },
      // {
      //   key: "buttonResetBaseMapPose",
      //   label: "Position du fond de plan",
      //   type: "button",
      //   options: {
      //     buttonLabel: "Réinitialiser",
      //     buttonVariant: "outlined",
      //     buttonColor: "primary",

      //     onClick: onClick,
      //   },
      // },
      {
        key: "imageKey",
        label: "Arrière plan",
        type: "imageKeyFromOptions",
        options: {
          images: bgImages,
          columns: 2,
        },
      },
      {
        key: "metadata",
        label: "Cartouche",
        type: "metadata",
      },
    ],
  };

  // return

  return template;
}
