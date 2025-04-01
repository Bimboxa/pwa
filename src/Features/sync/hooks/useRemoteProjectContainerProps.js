import {useState, useEffect} from "react";
import {useSelector} from "react-redux";

import getRemoteProjectContainerProps from "../services/getRemoteProjectContainerProps";

export default function useRemoteProjectContainerProps() {
  const [loading, setLoading] = useState(false);
  const [props, setProps] = useState(null);

  const updatedAt = useSelector(
    (s) => s.sync.remoteProjectContainerPropsUpdatedAt
  );

  useEffect(() => {
    const props = getRemoteProjectContainerProps();
    setLoading(false);
    setProps(props);
  }, [updatedAt]);

  return {value: props, loading};
}
