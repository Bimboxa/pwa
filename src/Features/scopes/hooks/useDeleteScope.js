import deleteScopeService from "../services/deleteScopeService";

export default function useDeleteScope() {
  const deleteScope = async (scopeId) => {
    await deleteScopeService(scopeId);
  };
  return deleteScope;
}
