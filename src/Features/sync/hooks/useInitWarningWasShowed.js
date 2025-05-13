import {useEffect} from "react";
import {useDispatch} from "react-redux";

import {setWarningWasShowed} from "Features/init/initSlice";

import getHideWarningFromLocalStorage from "../services/getHideWarningFromLocalStorage";

export default function useInitWarningWasShowed() {
  const dispatch = useDispatch();
  const hideWarning = getHideWarningFromLocalStorage();

  useEffect(() => {
    dispatch(setWarningWasShowed(hideWarning));
  });
}
