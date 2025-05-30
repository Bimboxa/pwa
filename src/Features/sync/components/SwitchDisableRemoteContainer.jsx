import {useSelector, useDispatch} from "react-redux";
import {toggleRemoteContainerEnabled} from "../syncSlice";
import SwitchGeneric from "Features/layout/components/SwitchGeneric";

export default function SwitchDisableRemoteContainer() {
  const label = "Synchro active";

  const dispatch = useDispatch();

  const disabled = useSelector((s) => s.sync.disableRemoteContainer);

  function handleChange() {
    dispatch(toggleRemoteContainerEnabled());
  }
  return (
    <SwitchGeneric label={label} checked={!disabled} onChange={handleChange} />
  );
}
