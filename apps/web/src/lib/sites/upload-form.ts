const DIRECTORY_INPUT_ID = 'site-directory';
const FILES_INPUT_ID = 'site-files';
const PATHS_CONTAINER_ID = 'site-upload-paths';
const CLIENT_ERROR_ID = 'site-upload-client-error';

function getDirectoryInput(): HTMLInputElement | null {
  return document.getElementById(DIRECTORY_INPUT_ID) as HTMLInputElement | null;
}

function getFilesInput(): HTMLInputElement | null {
  return document.getElementById(FILES_INPUT_ID) as HTMLInputElement | null;
}

function getPathsContainer(): HTMLElement | null {
  return document.getElementById(PATHS_CONTAINER_ID);
}

function getClientError(): HTMLElement | null {
  return document.getElementById(CLIENT_ERROR_ID);
}

function selectedFiles(): File[] {
  const directoryFiles = Array.from(getDirectoryInput()?.files || []);
  if (directoryFiles.length > 0) return directoryFiles;
  return Array.from(getFilesInput()?.files || []);
}

function syncManifestPaths(): void {
  const pathsContainer = getPathsContainer();
  if (!pathsContainer) return;
  pathsContainer.innerHTML = '';

  for (const file of selectedFiles()) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'path';
    input.value = file.webkitRelativePath || file.name || '';
    pathsContainer.appendChild(input);
  }
}

function clearClientError(): void {
  getClientError()?.setAttribute('hidden', '');
}

export function copyText(text: string): void {
  if (!text) return;
  navigator.clipboard.writeText(text).catch(() => {});
}

export function handleDirectoryChange(): void {
  const directoryInput = getDirectoryInput();
  const filesInput = getFilesInput();
  if (directoryInput?.files?.length) {
    if (filesInput) filesInput.value = '';
  }
  clearClientError();
  syncManifestPaths();
}

export function handleFilesChange(): void {
  const directoryInput = getDirectoryInput();
  const filesInput = getFilesInput();
  if (filesInput?.files?.length) {
    if (directoryInput) directoryInput.value = '';
  }
  clearClientError();
  syncManifestPaths();
}

export function handleUploadSubmit(event?: Event): void {
  if (selectedFiles().length === 0) {
    event?.preventDefault();
    getClientError()?.removeAttribute('hidden');
    return;
  }
  clearClientError();
  syncManifestPaths();
}
