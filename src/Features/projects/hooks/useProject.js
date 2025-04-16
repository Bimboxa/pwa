import {useMemo} from "react";
import {useSelector} from "react-redux";
import {getProjectSelector} from "../services/projectSelectorCache";

export default function useProject(options) {
  // data

  const selector = useMemo(() => getProjectSelector(options), [options]);

  // main

  const project = useSelector((s) => selector(s));

  return {value: project, loading: false};
}
