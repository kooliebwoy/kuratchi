export function closeNearestDialog(_value?: unknown, _event?: Event, element?: Element | null): void {
  const dialog = element?.closest ? element.closest('dialog') : null;
  if (dialog && typeof (dialog as HTMLDialogElement).close === 'function') {
    (dialog as HTMLDialogElement).close();
  }
}
