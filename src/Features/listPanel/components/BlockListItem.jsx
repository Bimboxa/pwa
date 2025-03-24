import {useDispatch} from "react-redux";

import {setOpenPanelListItem} from "../listPanelSlice";

import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

export default function BlockListItem() {
  const dispatch = useDispatch();

  // handlers

  function handleClose() {
    dispatch(setOpenPanelListItem(false));
  }

  return <HeaderTitleClose title="Block" onClose={handleClose} />;
}
