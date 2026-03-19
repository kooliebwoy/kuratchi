interface ResourceOption {
  id: string;
  name: string;
}

function getResourceField(): HTMLElement | null {
  return document.getElementById('resource-field');
}

function getResourceSelect(): HTMLSelectElement | null {
  return document.getElementById('token-resource') as HTMLSelectElement | null;
}

function readScopeOptions(scope: string): ResourceOption[] {
  const node = document.getElementById(`scope-data-${scope}`);
  if (!node?.textContent) return [];
  try {
    const parsed = JSON.parse(node.textContent);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resetResourceOptions(select: HTMLSelectElement, options: ResourceOption[]): void {
  select.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a resource...';
  select.appendChild(placeholder);

  for (const option of options) {
    const node = document.createElement('option');
    node.value = option.id;
    node.textContent = option.name;
    select.appendChild(node);
  }
}

export function handleScopeChange(_value?: unknown, _event?: Event, element?: Element | null): void {
  const select = (element as HTMLSelectElement | null) || getResourceSelect();
  const resourceField = getResourceField();
  const resourceSelect = getResourceSelect();
  if (!select || !resourceField || !resourceSelect) return;

  if (select.value === 'platform') {
    resourceField.style.display = 'none';
    resourceSelect.removeAttribute('required');
    resetResourceOptions(resourceSelect, []);
    return;
  }

  resourceField.style.display = '';
  resourceSelect.setAttribute('required', '');
  const options = readScopeOptions(select.value);
  resetResourceOptions(resourceSelect, options);
}
