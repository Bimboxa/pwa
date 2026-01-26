import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import { useSelector } from "react-redux";

export default function useMasterProjectPictures() {

    // data

    const { value: selectedProject } = useSelectedProject();
    const pictures = useSelector(s => s.masterProjectPictures.picturesByProjectIdMaster?.[selectedProject?.idMaster] || [])

    // return 

    return pictures

}