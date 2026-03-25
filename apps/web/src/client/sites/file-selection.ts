const SELECT_ALL_ID = 'site-files-select-all';
const BULK_DELETE_ID = 'site-files-bulk-delete';
const SELECTION_COUNT_ID = 'site-files-selection-count';
const FILE_CHECKBOX_SELECTOR = 'input[name="fileIds"]';

function getSelectAllCheckbox(): HTMLInputElement | null {
  return document.getElementById(SELECT_ALL_ID) as HTMLInputElement | null;
}

function getBulkDeleteButton(): HTMLButtonElement | null {
  return document.getElementById(BULK_DELETE_ID) as HTMLButtonElement | null;
}

function getSelectionCount(): HTMLElement | null {
  return document.getElementById(SELECTION_COUNT_ID);
}

function getFileCheckboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll(FILE_CHECKBOX_SELECTOR)) as HTMLInputElement[];
}

function syncSelectionState(): void {
  const checkboxes = getFileCheckboxes();
  const checkedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
  const selectAll = getSelectAllCheckbox();
  const bulkDelete = getBulkDeleteButton();
  const selectionCount = getSelectionCount();

  if (selectAll) {
    selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }

  if (bulkDelete) {
    bulkDelete.disabled = checkedCount === 0;
  }

  if (selectionCount) {
    selectionCount.textContent = checkedCount === 1 ? '1 file selected' : `${checkedCount} files selected`;
  }
}

export function handleSiteFileSelectionChange(): void {
  syncSelectionState();
}

export function toggleAllSiteFiles(): void {
  const checked = getSelectAllCheckbox()?.checked ?? false;
  for (const checkbox of getFileCheckboxes()) {
    checkbox.checked = checked;
  }
  syncSelectionState();
}
