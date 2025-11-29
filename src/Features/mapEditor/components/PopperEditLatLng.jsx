import { useSelector, useDispatch } from "react-redux";

import { setAnchorPositionLatLng } from "../mapEditorSlice";

import PopperBox from "Features/layout/components/PopperBox";
import SectionEditLatLng from "./SectionEditLatLng";

export default function PopperEditLatLng() {
  const dispatch = useDispatch();

  // data

  const anchorPosition = useSelector((s) => s.mapEditor.anchorPositionLatLng);
  console.log("anchorPosition", anchorPosition);

  // helper

  const open = Boolean(anchorPosition);

  // handlers

  async function handleClose() {
    dispatch(setAnchorPositionLatLng(null));
  }

  return (
    <PopperBox
      open={open}
      anchorPosition={anchorPosition}
      onClose={handleClose}
    >
      <SectionEditLatLng />
    </PopperBox>
  );
}
