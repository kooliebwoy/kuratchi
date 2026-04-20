/**
 * Client-only helper imported via `$lib/counter` from template scripts.
 * Proves that bare npm + `$lib/*` imports bundle through Vite transparently
 * (Gate 4).
 */
export function mountCounter(): void {
	const root = document.querySelector<HTMLDivElement>('[data-counter]');
	if (!root) return;
	const output = root.querySelector<HTMLElement>('[data-count]');
	const button = root.querySelector<HTMLButtonElement>('button');
	let count = 0;
	button?.addEventListener('click', () => {
		count += 1;
		if (output) output.textContent = String(count);
	});
}
