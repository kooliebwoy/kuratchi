import { describe, it, expect } from 'bun:test';
import { compileTemplate } from '../src/compiler/template.js';

/**
 * Helper to create a minimal render function and execute it.
 * Returns the rendered HTML string.
 */
function render(template: string, data: Record<string, unknown> = {}): string {
  const body = compileTemplate(template);
  
  const __rawHtml = (v: unknown) => {
    if (v == null) return '';
    return String(v);
  };
  const __sanitizeHtml = (v: unknown) => {
    let html = __rawHtml(v);
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    return html;
  };
  const __esc = (v: unknown) => {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Create function with data destructured into scope
  const keys = Object.keys(data);
  const values = Object.values(data);
  const fn = new Function(...keys, '__esc', '__rawHtml', '__sanitizeHtml', body + '\nreturn __html;');
  return fn(...values, __esc, __rawHtml, __sanitizeHtml);
}

describe('template attribute expressions', () => {
  describe('ternary expressions in attributes', () => {
    it('handles simple ternary with string literals', () => {
      const html = render(
        `<div class={isActive ? 'active' : 'inactive'}></div>`,
        { isActive: true }
      );
      expect(html).toContain('class="active"');
    });

    it('handles ternary evaluating to false branch', () => {
      const html = render(
        `<div class={isActive ? 'active' : 'inactive'}></div>`,
        { isActive: false }
      );
      expect(html).toContain('class="inactive"');
    });

    it('handles ternary with empty string', () => {
      const html = render(
        `<button class={hasError ? 'error' : ''}></button>`,
        { hasError: false }
      );
      expect(html).toContain('class=""');
    });

    it('handles ternary with comparison operators', () => {
      const html = render(
        `<span class={count > 0 ? 'has-items' : 'empty'}></span>`,
        { count: 5 }
      );
      expect(html).toContain('class="has-items"');
    });

    it('handles ternary with equality check', () => {
      const html = render(
        `<div class={status === 'active' ? 'green' : 'gray'}></div>`,
        { status: 'active' }
      );
      expect(html).toContain('class="green"');
    });

    it('handles nested ternary expressions', () => {
      const html = render(
        `<div class={status === 'success' ? 'green' : status === 'error' ? 'red' : 'gray'}></div>`,
        { status: 'error' }
      );
      expect(html).toContain('class="red"');
    });

    it('handles ternary with template literals', () => {
      const html = render(
        '<a href={isExternal ? `https://${domain}` : `/local/${path}`}></a>',
        { isExternal: true, domain: 'example.com', path: 'page' }
      );
      expect(html).toContain('href="https://example.com"');
    });

    it('handles ternary with function calls', () => {
      const html = render(
        `<span class={isUpper ? toUpper(text) : toLower(text)}></span>`,
        { 
          isUpper: true, 
          text: 'Hello',
          toUpper: (s: string) => s.toUpperCase(),
          toLower: (s: string) => s.toLowerCase()
        }
      );
      expect(html).toContain('class="HELLO"');
    });

    it('handles ternary with function call in condition', () => {
      const html = render(
        `<div class={isValid(value) ? 'valid' : 'invalid'}></div>`,
        { 
          value: 10,
          isValid: (v: number) => v > 5
        }
      );
      expect(html).toContain('class="valid"');
    });

    it('handles ternary with method calls', () => {
      const html = render(
        `<span class={items.length > 0 ? items.join('-') : 'none'}></span>`,
        { items: ['a', 'b', 'c'] }
      );
      expect(html).toContain('class="a-b-c"');
    });

    it('handles ternary with object property access', () => {
      const html = render(
        `<div class={user.isAdmin ? 'admin' : 'user'}></div>`,
        { user: { isAdmin: true } }
      );
      expect(html).toContain('class="admin"');
    });

    it('handles ternary with optional chaining', () => {
      const html = render(
        `<div class={user?.role === 'admin' ? 'admin' : 'guest'}></div>`,
        { user: null }
      );
      expect(html).toContain('class="guest"');
    });

    it('handles ternary with nullish coalescing', () => {
      const html = render(
        `<div class={(value ?? 0) > 5 ? 'high' : 'low'}></div>`,
        { value: null }
      );
      expect(html).toContain('class="low"');
    });

    it('handles ternary with logical AND', () => {
      const html = render(
        `<div class={isActive && isEnabled ? 'on' : 'off'}></div>`,
        { isActive: true, isEnabled: true }
      );
      expect(html).toContain('class="on"');
    });

    it('handles ternary with logical OR', () => {
      const html = render(
        `<div class={isActive || isEnabled ? 'on' : 'off'}></div>`,
        { isActive: false, isEnabled: true }
      );
      expect(html).toContain('class="on"');
    });

    it('handles ternary with negation', () => {
      const html = render(
        `<div class={!isDisabled ? 'enabled' : 'disabled'}></div>`,
        { isDisabled: false }
      );
      expect(html).toContain('class="enabled"');
    });

    it('handles multiple ternaries in same element', () => {
      const html = render(
        `<div class={isActive ? 'active' : ''} data-state={isOpen ? 'open' : 'closed'}></div>`,
        { isActive: true, isOpen: false }
      );
      expect(html).toContain('class="active"');
      expect(html).toContain('data-state="closed"');
    });
  });

  describe('boolean attributes', () => {
    it('renders disabled when truthy', () => {
      const html = render(
        `<button disabled={isLoading}>Submit</button>`,
        { isLoading: true }
      );
      expect(html).toContain('<button disabled>');
    });

    it('omits disabled when falsy', () => {
      const html = render(
        `<button disabled={isLoading}>Submit</button>`,
        { isLoading: false }
      );
      expect(html).toContain('<button>');
      expect(html).not.toContain('disabled');
    });

    it('renders checked when truthy', () => {
      const html = render(
        `<input type="checkbox" checked={isChecked} />`,
        { isChecked: true }
      );
      expect(html).toContain('checked');
    });

    it('omits checked when falsy', () => {
      const html = render(
        `<input type="checkbox" checked={isChecked} />`,
        { isChecked: false }
      );
      expect(html).not.toContain('checked');
    });

    it('renders selected when truthy', () => {
      const html = render(
        `<option selected={isSelected}>Option</option>`,
        { isSelected: true }
      );
      expect(html).toContain('<option selected>');
    });

    it('omits selected when falsy', () => {
      const html = render(
        `<option selected={isSelected}>Option</option>`,
        { isSelected: false }
      );
      expect(html).not.toContain('selected');
    });

    it('renders readonly when truthy', () => {
      const html = render(
        `<input readonly={isReadonly} />`,
        { isReadonly: true }
      );
      expect(html).toContain('readonly');
    });

    it('renders required when truthy', () => {
      const html = render(
        `<input required={isRequired} />`,
        { isRequired: true }
      );
      expect(html).toContain('required');
    });

    it('renders hidden when truthy', () => {
      const html = render(
        `<div hidden={isHidden}>Content</div>`,
        { isHidden: true }
      );
      expect(html).toContain('<div hidden>');
    });

    it('renders open when truthy', () => {
      const html = render(
        `<details open={isOpen}><summary>Title</summary></details>`,
        { isOpen: true }
      );
      expect(html).toContain('<details open>');
    });

    it('renders multiple when truthy', () => {
      const html = render(
        `<select multiple={allowMultiple}></select>`,
        { allowMultiple: true }
      );
      expect(html).toContain('multiple');
    });

    it('renders autofocus when truthy', () => {
      const html = render(
        `<input autofocus={shouldFocus} />`,
        { shouldFocus: true }
      );
      expect(html).toContain('autofocus');
    });

    it('handles boolean with comparison expression', () => {
      const html = render(
        `<button disabled={count === 0}>Submit</button>`,
        { count: 0 }
      );
      expect(html).toContain('disabled');
    });

    it('handles boolean with function call', () => {
      const html = render(
        `<button disabled={isDisabled()}>Submit</button>`,
        { isDisabled: () => true }
      );
      expect(html).toContain('disabled');
    });

    it('handles boolean with method call', () => {
      const html = render(
        `<button disabled={items.length === 0}>Submit</button>`,
        { items: [] }
      );
      expect(html).toContain('disabled');
    });

    it('handles boolean with negation', () => {
      const html = render(
        `<button disabled={!isEnabled}>Submit</button>`,
        { isEnabled: false }
      );
      expect(html).toContain('disabled');
    });

    it('handles boolean with logical AND', () => {
      const html = render(
        `<button disabled={isLoading && !hasError}>Submit</button>`,
        { isLoading: true, hasError: false }
      );
      expect(html).toContain('disabled');
    });

    it('handles boolean with optional chaining', () => {
      const html = render(
        `<button disabled={form?.isSubmitting}>Submit</button>`,
        { form: { isSubmitting: true } }
      );
      expect(html).toContain('disabled');
    });

    it('handles boolean with nullish value (null)', () => {
      const html = render(
        `<button disabled={value}>Submit</button>`,
        { value: null }
      );
      expect(html).not.toContain('disabled');
    });

    it('handles boolean with nullish value (undefined)', () => {
      const html = render(
        `<button disabled={value}>Submit</button>`,
        { value: undefined }
      );
      expect(html).not.toContain('disabled');
    });

    it('handles boolean with zero (falsy)', () => {
      const html = render(
        `<button disabled={count}>Submit</button>`,
        { count: 0 }
      );
      expect(html).not.toContain('disabled');
    });

    it('handles boolean with empty string (falsy)', () => {
      const html = render(
        `<button disabled={text}>Submit</button>`,
        { text: '' }
      );
      expect(html).not.toContain('disabled');
    });

    it('handles multiple boolean attributes', () => {
      const html = render(
        `<input disabled={isDisabled} readonly={isReadonly} required={isRequired} />`,
        { isDisabled: true, isReadonly: false, isRequired: true }
      );
      expect(html).toContain('disabled');
      expect(html).not.toContain('readonly');
      expect(html).toContain('required');
    });
  });

  describe('select/option selected patterns', () => {
    it('handles selected with equality check', () => {
      const html = render(
        `<option value="a" selected={value === 'a'}>A</option>`,
        { value: 'a' }
      );
      expect(html).toContain('selected');
    });

    it('handles selected in loop context', () => {
      const template = `for (const opt of options) {
  <option value={opt.id} selected={opt.id === selectedId}>{opt.name}</option>
}`;
      const html = render(template, { 
        options: [
          { id: '1', name: 'One' },
          { id: '2', name: 'Two' },
          { id: '3', name: 'Three' }
        ],
        selectedId: '2'
      });
      // Should have exactly one selected
      const matches = html.match(/selected/g);
      expect(matches?.length).toBe(1);
      expect(html).toContain('value="2" selected');
    });
  });

  describe('checkbox checked patterns', () => {
    it('handles checked with boolean property', () => {
      const html = render(
        `<input type="checkbox" checked={todo.completed} />`,
        { todo: { completed: true } }
      );
      expect(html).toContain('checked');
    });

    it('handles checked in loop context', () => {
      const template = `for (const todo of todos) {
  <input type="checkbox" checked={todo.completed} />
}`;
      const html = render(template, { 
        todos: [
          { completed: true },
          { completed: false },
          { completed: true }
        ]
      });
      const matches = html.match(/checked/g);
      expect(matches?.length).toBe(2);
    });

    it('handles checked with includes check', () => {
      const html = render(
        `<input type="checkbox" checked={selectedIds.includes(item.id)} />`,
        { selectedIds: [1, 3, 5], item: { id: 3 } }
      );
      expect(html).toContain('checked');
    });
  });

  describe('edge cases and complex expressions', () => {
    it('handles expression with parentheses', () => {
      const html = render(
        `<div class={(a + b) > 10 ? 'big' : 'small'}></div>`,
        { a: 5, b: 6 }
      );
      expect(html).toContain('class="big"');
    });

    it('handles expression with array access', () => {
      const html = render(
        `<div class={items[0] === 'first' ? 'yes' : 'no'}></div>`,
        { items: ['first', 'second'] }
      );
      expect(html).toContain('class="yes"');
    });

    it('handles expression with computed property', () => {
      const html = render(
        `<div class={obj[key] ? 'found' : 'missing'}></div>`,
        { obj: { foo: true }, key: 'foo' }
      );
      expect(html).toContain('class="found"');
    });

    it('handles expression with typeof', () => {
      const html = render(
        `<div class={typeof value === 'string' ? 'string' : 'other'}></div>`,
        { value: 'hello' }
      );
      expect(html).toContain('class="string"');
    });

    it('handles expression with instanceof (simulated)', () => {
      const html = render(
        `<div class={Array.isArray(value) ? 'array' : 'other'}></div>`,
        { value: [1, 2, 3] }
      );
      expect(html).toContain('class="array"');
    });

    it('handles IIFE in expression', () => {
      const html = render(
        `<div class={(() => isActive ? 'active' : 'inactive')()}></div>`,
        { isActive: true }
      );
      expect(html).toContain('class="active"');
    });

    it('handles chained method calls', () => {
      const html = render(
        `<div class={text.trim().toLowerCase()}></div>`,
        { text: '  HELLO  ' }
      );
      expect(html).toContain('class="hello"');
    });

    it('handles spread in array for join', () => {
      const html = render(
        `<div class={[base, isActive && 'active', isLarge && 'large'].filter(Boolean).join(' ')}></div>`,
        { base: 'btn', isActive: true, isLarge: false }
      );
      expect(html).toContain('class="btn active"');
    });

    it('escapes HTML in attribute values', () => {
      const html = render(
        `<div title={text}></div>`,
        { text: '<script>alert("xss")</script>' }
      );
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>');
    });

    it('escapes quotes in attribute values', () => {
      const html = render(
        `<div title={text}></div>`,
        { text: 'He said "hello"' }
      );
      expect(html).toContain('&quot;');
    });
  });

  describe('real-world patterns', () => {
    it('handles conditional CSS class pattern', () => {
      const html = render(
        `<button class={isLoading ? 'btn btn-loading' : 'btn btn-primary'} disabled={isLoading}>
  {isLoading ? 'Loading...' : 'Submit'}
</button>`,
        { isLoading: true }
      );
      expect(html).toContain('class="btn btn-loading"');
      expect(html).toContain('disabled');
      expect(html).toContain('Loading...');
    });

    it('handles form validation pattern', () => {
      const html = render(
        `<input 
  class={hasError ? 'input input-error' : 'input'}
  aria-invalid={hasError ? 'true' : 'false'}
  disabled={isSubmitting}
/>`,
        { hasError: true, isSubmitting: false }
      );
      expect(html).toContain('class="input input-error"');
      expect(html).toContain('aria-invalid="true"');
      expect(html).not.toContain('disabled');
    });

    it('handles tab navigation pattern', () => {
      const template = `for (const tab of tabs) {
  <button 
    class={tab.id === activeTab ? 'tab active' : 'tab'}
    aria-selected={tab.id === activeTab ? 'true' : 'false'}
  >{tab.label}</button>
}`;
      const html = render(template, {
        tabs: [
          { id: 'home', label: 'Home' },
          { id: 'settings', label: 'Settings' }
        ],
        activeTab: 'settings'
      });
      expect(html).toContain('class="tab"');
      expect(html).toContain('class="tab active"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('aria-selected="false"');
    });

    it('handles dropdown with selected option', () => {
      const template = `<select>
  for (const country of countries) {
    <option value={country.code} selected={country.code === selectedCountry}>{country.name}</option>
  }
</select>`;
      const html = render(template, {
        countries: [
          { code: 'US', name: 'United States' },
          { code: 'CA', name: 'Canada' },
          { code: 'MX', name: 'Mexico' }
        ],
        selectedCountry: 'CA'
      });
      expect(html).toContain('value="CA" selected');
      expect(html).not.toContain('value="US" selected');
    });

    it('handles todo list with checkboxes', () => {
      const template = `for (const todo of todos) {
  <li class={todo.completed ? 'completed' : ''}>
    <input type="checkbox" checked={todo.completed} />
    <span>{todo.text}</span>
  </li>
}`;
      const html = render(template, {
        todos: [
          { text: 'Buy milk', completed: true },
          { text: 'Walk dog', completed: false }
        ]
      });
      expect(html).toContain('class="completed"');
      expect(html).toContain('class=""');
      const checkedMatches = html.match(/checked/g);
      expect(checkedMatches?.length).toBe(1);
    });
  });
});
