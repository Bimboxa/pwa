// Number of the next comment of a listing: max + 1 over the live comments
// (a deleted number is reused only when it was the last one).
export default function getNextCommentNum(comments) {
  const nums = (comments ?? [])
    .filter((c) => c && !c.deletedAt)
    .map((c) => Number(c.num))
    .filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}
