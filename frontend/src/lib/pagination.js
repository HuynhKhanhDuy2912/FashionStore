export function getPaginationRange(currentPage, totalPages, boundaryCount = 2, siblingCount = 1) {
  const range = (start, end) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  // Nếu đủ ít, hiện hết không cần "...".
  const totalNumbers = boundaryCount * 2 + siblingCount * 2 + 3;
  if (totalPages <= totalNumbers) return range(1, totalPages);

  const startPages = range(1, boundaryCount);
  const endPages = range(totalPages - boundaryCount + 1, totalPages);

  const siblingStart = Math.max(
    Math.min(currentPage - siblingCount, totalPages - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  );
  const siblingEnd = Math.min(
    Math.max(currentPage + siblingCount, boundaryCount + siblingCount * 2 + 2),
    totalPages - boundaryCount - 1,
  );

  return [
    ...startPages,
    siblingStart > boundaryCount + 2 ? "left-ellipsis" : boundaryCount + 1,
    ...range(siblingStart, siblingEnd),
    siblingEnd < totalPages - boundaryCount - 1 ? "right-ellipsis" : totalPages - boundaryCount,
    ...endPages,
  ];
}
