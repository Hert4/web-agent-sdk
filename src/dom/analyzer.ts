/**
 * DOM Analyzer - Automatically analyzes any webpage and extracts context
 * No configuration needed - works universally on any website
 */

export interface InteractiveElement {
  index: number;
  tagName: string;
  type: string;
  role: string;
  text: string;
  placeholder?: string;
  ariaLabel?: string;
  name?: string;
  id?: string;
  className?: string;
  href?: string;
  value?: string;
  isVisible: boolean;
  isEnabled: boolean;
  rect: DOMRect;
  xpath: string;
  selector: string;
}

export interface PageContext {
  url: string;
  title: string;
  description?: string;
  elements: InteractiveElement[];
  textContent: string;
  forms: FormInfo[];
  tables: TableInfo[];
  links: LinkInfo[];
  headings: HeadingInfo[];
}

export interface FormInfo {
  index: number;
  action?: string;
  method?: string;
  fields: FormFieldInfo[];
}

export interface FormFieldInfo {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  elementIndex: number;
}

export interface TableInfo {
  index: number;
  headers: string[];
  rowCount: number;
  caption?: string;
}

export interface LinkInfo {
  text: string;
  href: string;
  elementIndex: number;
}

export interface HeadingInfo {
  level: number;
  text: string;
}

/**
 * Interactive element selectors - elements users can interact with
 */
const INTERACTIVE_SELECTORS = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[role="combobox"]',
  '[role="listbox"]',
  '[role="option"]',
  '[onclick]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export class DOMAnalyzer {
  private elementCache: Map<number, Element> = new Map();
  private lastAnalysis: PageContext | null = null;

  /**
   * Analyze current page and extract all context
   */
  analyze(): PageContext {
    const elements = this.findInteractiveElements();
    
    this.lastAnalysis = {
      url: window.location.href,
      title: document.title,
      description: this.getMetaDescription(),
      elements,
      textContent: this.getMainTextContent(),
      forms: this.analyzeForms(elements),
      tables: this.analyzeTables(),
      links: this.extractLinks(elements),
      headings: this.extractHeadings(),
    };

    return this.lastAnalysis;
  }

  /**
   * Get element by index for interaction
   */
  getElement(index: number): Element | null {
    return this.elementCache.get(index) || null;
  }

  /**
   * Generate human-readable description of the page state
   */
  getStateDescription(): string {
    const ctx = this.lastAnalysis || this.analyze();
    
    let description = `# Page: ${ctx.title}\nURL: ${ctx.url}\n\n`;
    
    if (ctx.description) {
      description += `Description: ${ctx.description}\n\n`;
    }

    // Add headings structure
    if (ctx.headings.length > 0) {
      description += `## Page Structure\n`;
      ctx.headings.slice(0, 10).forEach(h => {
        description += `${'  '.repeat(h.level - 1)}- ${h.text}\n`;
      });
      description += '\n';
    }

    // Add forms
    if (ctx.forms.length > 0) {
      description += `## Forms (${ctx.forms.length})\n`;
      ctx.forms.forEach((form, i) => {
        description += `Form ${i + 1}:\n`;
        form.fields.forEach(field => {
          const required = field.required ? ' (required)' : '';
          description += `  - [${field.elementIndex}] ${field.label || field.name || field.type}${required}\n`;
        });
      });
      description += '\n';
    }

    // Add interactive elements
    description += `## Interactive Elements (${ctx.elements.length})\n`;
    ctx.elements.slice(0, 50).forEach(el => {
      const label = el.ariaLabel || el.text || el.placeholder || el.name || el.tagName;
      const truncated = label.length > 50 ? label.substring(0, 47) + '...' : label;
      description += `[${el.index}] ${el.type}: ${truncated}\n`;
    });

    if (ctx.elements.length > 50) {
      description += `... and ${ctx.elements.length - 50} more elements\n`;
    }

    return description;
  }

  /**
   * Find all interactive elements on the page
   */
  private findInteractiveElements(): InteractiveElement[] {
    this.elementCache.clear();
    const elements: InteractiveElement[] = [];
    const seen = new Set<Element>();
    
    document.querySelectorAll(INTERACTIVE_SELECTORS).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);

      // Skip hidden elements
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isVisible = rect.width > 0 && 
                       rect.height > 0 && 
                       style.visibility !== 'hidden' && 
                       style.display !== 'none' &&
                       style.opacity !== '0';

      if (!isVisible) return;

      const index = elements.length;
      this.elementCache.set(index, el);

      elements.push({
        index,
        tagName: el.tagName.toLowerCase(),
        type: this.getElementType(el),
        role: el.getAttribute('role') || this.inferRole(el),
        text: this.getElementText(el),
        placeholder: (el as HTMLInputElement).placeholder,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        name: (el as HTMLInputElement).name || undefined,
        id: el.id || undefined,
        className: el.className || undefined,
        href: (el as HTMLAnchorElement).href || undefined,
        value: (el as HTMLInputElement).value || undefined,
        isVisible: true,
        isEnabled: !(el as HTMLInputElement).disabled,
        rect,
        xpath: this.getXPath(el),
        selector: this.getUniqueSelector(el),
      });
    });

    return elements;
  }

  private getElementType(el: Element): string {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      return `input[${(el as HTMLInputElement).type}]`;
    }
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'select') return 'dropdown';
    if (tag === 'textarea') return 'textarea';
    return el.getAttribute('role') || tag;
  }

  private inferRole(el: Element): string {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type;
      if (type === 'submit' || type === 'button') return 'button';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      return 'textbox';
    }
    if (tag === 'select') return 'combobox';
    if (tag === 'textarea') return 'textbox';
    return 'generic';
  }

  private getElementText(el: Element): string {
    // Try aria-label first
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;

    // Try inner text
    const text = el.textContent?.trim();
    if (text && text.length < 100) return text;

    // Try value for inputs
    const value = (el as HTMLInputElement).value;
    if (value) return value;

    // Try placeholder
    const placeholder = (el as HTMLInputElement).placeholder;
    if (placeholder) return placeholder;

    // Try title
    const title = el.getAttribute('title');
    if (title) return title;

    return el.tagName.toLowerCase();
  }

  private getXPath(el: Element): string {
    const parts: string[] = [];
    let current: Element | null = el;

    while (current && current !== document.body) {
      let index = 1;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) index++;
        sibling = sibling.previousElementSibling;
      }

      const tag = current.tagName.toLowerCase();
      parts.unshift(`${tag}[${index}]`);
      current = current.parentElement;
    }

    return '//' + parts.join('/');
  }

  private getUniqueSelector(el: Element): string {
    if (el.id) return `#${el.id}`;
    
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList).slice(0, 2).join('.');
    
    if (classes) {
      const selector = `${tag}.${classes}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Fallback to nth-child
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(el) + 1;
      return `${this.getUniqueSelector(parent)} > ${tag}:nth-child(${index})`;
    }

    return tag;
  }

  private getMetaDescription(): string | undefined {
    const meta = document.querySelector('meta[name="description"]');
    return meta?.getAttribute('content') || undefined;
  }

  private getMainTextContent(): string {
    // Try to get main content area
    const main = document.querySelector('main, article, [role="main"], .content, #content');
    if (main) {
      return main.textContent?.trim().substring(0, 2000) || '';
    }
    return document.body.textContent?.trim().substring(0, 2000) || '';
  }

  private analyzeForms(elements: InteractiveElement[]): FormInfo[] {
    const forms: FormInfo[] = [];
    
    document.querySelectorAll('form').forEach((form, index) => {
      const fields: FormFieldInfo[] = [];
      
      form.querySelectorAll('input, select, textarea').forEach((field) => {
        const el = field as HTMLInputElement;
        if (el.type === 'hidden') return;

        // Find associated label
        let label = '';
        if (el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          label = labelEl?.textContent?.trim() || '';
        }
        if (!label && el.parentElement?.tagName === 'LABEL') {
          label = el.parentElement.textContent?.trim() || '';
        }

        // Find element index
        const elementIndex = elements.findIndex(e => 
          this.elementCache.get(e.index) === field
        );

        fields.push({
          name: el.name || el.id || '',
          type: el.type || el.tagName.toLowerCase(),
          label: label || undefined,
          placeholder: el.placeholder || undefined,
          required: el.required || el.hasAttribute('aria-required'),
          elementIndex,
        });
      });

      forms.push({
        index,
        action: form.action || undefined,
        method: form.method || undefined,
        fields,
      });
    });

    return forms;
  }

  private analyzeTables(): TableInfo[] {
    const tables: TableInfo[] = [];
    
    document.querySelectorAll('table').forEach((table, index) => {
      const headers: string[] = [];
      table.querySelectorAll('th').forEach(th => {
        headers.push(th.textContent?.trim() || '');
      });

      const caption = table.querySelector('caption')?.textContent?.trim();
      const rowCount = table.querySelectorAll('tr').length;

      tables.push({ index, headers, rowCount, caption });
    });

    return tables;
  }

  private extractLinks(elements: InteractiveElement[]): LinkInfo[] {
    return elements
      .filter(el => el.tagName === 'a' && el.href)
      .map(el => ({
        text: el.text,
        href: el.href!,
        elementIndex: el.index,
      }));
  }

  private extractHeadings(): HeadingInfo[] {
    const headings: HeadingInfo[] = [];
    document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      const level = parseInt(h.tagName[1]);
      const text = h.textContent?.trim() || '';
      if (text) {
        headings.push({ level, text });
      }
    });
    return headings;
  }
}
