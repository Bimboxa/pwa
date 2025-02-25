import {useSelector, useDispatch} from "react-redux";

import {setAnchorPositionScale} from "../mapEditorSlice";

import PopperBox from "Features/layout/components/PopperBox";
import SectionEditScale from "./SectionEditScale";

export default function PopperEditScale() {
  const dispatch = useDispatch();

  // data

  const anchorPosition = useSelector((s) => s.mapEditor.anchorPositionScale);

  // helper

  const open = Boolean(anchorPosition);

  // handlers

  function handleClose() {
    dispatch(setAnchorPositionScale(null));
  }

  return (
    <PopperBox
      open={open}
      anchorPosition={anchorPosition}
      onClose={handleClose}
    >
      <SectionEditScale />
    </PopperBox>
  );
}
