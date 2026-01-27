import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import { useSelector } from "react-redux";
import useDemoPictures from "./useDemoPictures";
import groupItemsByKeys from "Features/misc/utils/groupItemsByKeys";
import isoToReadable from "Features/date/utils/isoToReadable";

export default function useMasterProjectPictures(options) {

    // options

    const groupByDate = options?.groupByDate;

    // data

    const { value: selectedProject } = useSelectedProject();

    const pictures = useSelector(s => s.masterProjectPictures.picturesByProjectIdMaster?.[selectedProject?.idMaster] || [])
    const demoPictures = useDemoPictures();

    // return 

    let result = [...demoPictures, ...pictures].map(p => ({
        ...p,
        readableDate: isoToReadable(p.createdAt)
    }));

    if (groupByDate) {
        result = groupItemsByKeys(result, ['readableDate'], 'array');
    }

    return result;
}