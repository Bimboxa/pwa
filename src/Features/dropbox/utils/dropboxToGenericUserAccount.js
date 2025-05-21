export default function dropboxToGenericUserAccount(account) {
  return {
    email: account.email,
    teamMemberId: account.temp_member_id,
    namespaceId: account.root_info.root_namespace_id,
  };
}
