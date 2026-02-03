import { useDispatch } from "react-redux";

import { setManagedDataByAgent } from "../chatSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useEntities from "Features/entities/hooks/useEntities";
import useZonesTree from "Features/zones/hooks/useZonesTree";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";


import callAgentDataManagerService from "../services/callAgentDataManagerService";
import { applyChanges } from "../utils/applyChanges";


export default function useCallAgentDataManager() {
    const dispatch = useDispatch();

    // data

    const appConfig = useAppConfig();

    const { value: zonesTree } = useZonesTree();
    const { value: listing } = useSelectedListing();
    console.log("zonesTree", zonesTree, listing);

    // helpers

    const baseUrl = appConfig?.features?.chat?.agentDataManager?.baseUrl;
    const AGENT_API_TOKEN = "LEI_AGENT_2!"

    const data = zonesTree;
    const structure = "ZONES_TREE";
    const dataName = listing?.name;


    // service

    const callAgentDataManager = async (userPrompt) => {
        try {
            const diffs = await callAgentDataManagerService({
                data,
                dataName,
                userPrompt,
                structure,
                baseUrl,
                AGENT_API_TOKEN
            });
            const result = applyChanges(data, diffs);
            console.log("result_ai", result, data, diffs);

            dispatch(setManagedDataByAgent({ structure, data: result }));
        } catch (e) {
            console.log("error", e);
        }
    };

    return callAgentDataManager;
}