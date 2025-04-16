import {useDispatch} from "react-redux";

import {useEffect} from "react";

export default function useInitRemoteProjectsContainers() {
  const dispatch = useDispatch();

  useEffect(() => {
    console.log("[ TO DELETE ]");
  }, []);
}
