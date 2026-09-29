export const BUSINESS_OBJECT_STATUS = { OPEN: "OPEN", CLOSED: "CLOSED" };

// Status of a business object of a type with the status feature (ISSUE):
// stored in `status`, a row without it is OPEN. `closedAt` (ISO string) is
// written along by useUpdateBusinessObject.
export default function getBusinessObjectStatus(businessObject) {
  return businessObject?.status === BUSINESS_OBJECT_STATUS.CLOSED
    ? BUSINESS_OBJECT_STATUS.CLOSED
    : BUSINESS_OBJECT_STATUS.OPEN;
}

export function isBusinessObjectClosed(businessObject) {
  return (
    getBusinessObjectStatus(businessObject) === BUSINESS_OBJECT_STATUS.CLOSED
  );
}
