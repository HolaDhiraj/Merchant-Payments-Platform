// Row number across pages, so S.No keeps counting after page 1.
export function serialNumber(page: number, pageSize: number, index: number): number {
  return (page - 1) * pageSize + index + 1;
}
