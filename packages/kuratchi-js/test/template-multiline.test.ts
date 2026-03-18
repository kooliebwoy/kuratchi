import { describe, it, expect } from 'bun:test';
import { compileTemplate } from '../src/compiler/template.js';

describe('template compiler multi-line expressions', () => {
  it('handles ternary expressions spanning multiple lines', () => {
    const template = `<span>{isRunning ?
  'Running' : 'Stopped'}</span>`;
    const result = compileTemplate(template);
    expect(result).toContain('isRunning ?');
    expect(result).toContain("'Running'");
    expect(result).toContain("'Stopped'");
    expect(result).not.toContain('isRunning ?)');
  });

  it('handles multi-line object expressions in interpolation', () => {
    const template = `<div data-config={JSON.stringify({
  name: 'test',
  value: 123
})}></div>`;
    const result = compileTemplate(template);
    expect(result).toContain('JSON.stringify');
    expect(result).toContain("name: 'test'");
    expect(result).toContain('value: 123');
  });

  it('handles multi-line function calls in interpolation', () => {
    const template = `<p>{formatDate(
  date,
  'YYYY-MM-DD'
)}</p>`;
    const result = compileTemplate(template);
    expect(result).toContain('formatDate');
    expect(result).toContain('date');
    expect(result).toContain("'YYYY-MM-DD'");
  });

  it('handles nested braces in multi-line expressions', () => {
    const template = `<span>{items.map(x => {
  return x.name;
}).join(', ')}</span>`;
    const result = compileTemplate(template);
    expect(result).toContain('items.map');
    expect(result).toContain('return x.name');
    expect(result).toContain(".join(', ')");
  });

  it('preserves single-line expressions unchanged', () => {
    const template = `<span>{isRunning ? 'yes' : 'no'}</span>`;
    const result = compileTemplate(template);
    expect(result).toContain("isRunning ? 'yes' : 'no'");
  });

  it('handles complex nested ternary with multi-line HTML content', () => {
    const template = `{isRunning ? (
						<svg class="spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M21 12a9 9 0 11-6.219-8.56"/>
						</svg>
					) : isComplete ? (
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
							<polyline points="22 4 12 14.01 9 11.01"/>
						</svg>
					) : isFailed ? (
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/>
							<line x1="15" y1="9" x2="9" y2="15"/>
							<line x1="9" y1="9" x2="15" y2="15"/>
						</svg>
					) : (
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="10"/>
							<polyline points="12 6 12 12 16 14"/>
						</svg>
					)}`;
    const result = compileTemplate(template);
    // Should contain all condition checks
    expect(result).toContain('isRunning ?');
    expect(result).toContain('isComplete ?');
    expect(result).toContain('isFailed ?');
    // Should contain SVG content
    expect(result).toContain('class="spinner"');
    expect(result).toContain('polyline points="22 4 12 14.01 9 11.01"');
    // Should NOT have truncated expressions
    expect(result).not.toContain('isRunning ?)');
    expect(result).not.toContain('isComplete ?)');
    expect(result).not.toContain('isFailed ?)');
  });
});
