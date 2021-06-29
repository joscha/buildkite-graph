let value = 0;
export function resetUuidCounter(): void {
  value = 0;
}
jest.mock('uniqid', (): (() => string) => {
  return () => `_${value++}`;
});
