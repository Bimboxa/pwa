import { useDispatch } from "react-redux";

import { setNewAnnotation } from "../annotationsSlice";

import useAnnotationSpriteImage from "./useAnnotationSpriteImage";

import theme from "Styles/theme";

export default function useInitDefaultNewAnnotation() {
  const dispatch = useDispatch();
  const spriteImage = useAnnotationSpriteImage();

  return () => {
    dispatch(
      setNewAnnotation({
        type: "MARKER",
        fillColor: theme.palette.secondary.main,
        iconKey: spriteImage?.iconKeys?.[0],
      })
    );
  };
}
