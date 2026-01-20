/**
 * Action Executor - Performs actions on any webpage
 * Automatically handles clicks, typing, scrolling, navigation
 */

import type { DOMAnalyzer, InteractiveElement } from '../dom/analyzer';

export type ActionType = 
  | 'click'
  | 'type'
  | 'clear'
  | 'select'
  | 'scroll'
  | 'hover'
  | 'focus'
  | 'wait'
  | 'navigate'
  | 'goBack'
  | 'goForward'
  | 'refresh'
  | 'done';

export interface ActionParams {
  click: { index: number };
  type: { index: number; text: string; clear?: boolean };
  clear: { index: number };
  select: { index: number; value: string };
  scroll: { direction: 'up' | 'down' | 'left' | 'right'; amount?: number };
  hover: { index: number };
  focus: { index: number };
  wait: { ms: number };
  navigate: { url: string };
  goBack: Record<string, never>;
  goForward: Record<string, never>;
  refresh: Record<string, never>;
  done: { reasoning?: string };
}

export interface ActionResult {
  success: boolean;
  action: ActionType;
  message: string;
  error?: string;
  elementInfo?: Partial<InteractiveElement>;
}

export class ActionExecutor {
  constructor(private analyzer: DOMAnalyzer) {}

  async execute<T extends ActionType>(
    action: T,
    params: ActionParams[T]
  ): Promise<ActionResult> {
    try {
      switch (action) {
        case 'click':
          return await this.click((params as ActionParams['click']).index);
        case 'type':
          const typeParams = params as ActionParams['type'];
          return await this.type(typeParams.index, typeParams.text, typeParams.clear);
        case 'clear':
          return await this.clear((params as ActionParams['clear']).index);
        case 'select':
          const selectParams = params as ActionParams['select'];
          return await this.select(selectParams.index, selectParams.value);
        case 'scroll':
          const scrollParams = params as ActionParams['scroll'];
          return this.scroll(scrollParams.direction, scrollParams.amount);
        case 'hover':
          return await this.hover((params as ActionParams['hover']).index);
        case 'focus':
          return await this.focus((params as ActionParams['focus']).index);
        case 'wait':
          return await this.wait((params as ActionParams['wait']).ms);
        case 'navigate':
          return this.navigate((params as ActionParams['navigate']).url);
        case 'goBack':
          return this.goBack();
        case 'goForward':
          return this.goForward();
        case 'refresh':
          return this.refresh();
        default:
          return { success: false, action, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      return {
        success: false,
        action,
        message: `Action failed: ${action}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async click(index: number): Promise<ActionResult> {
    const element = this.analyzer.getElement(index) as HTMLElement;
    if (!element) {
      return { success: false, action: 'click', message: `Element [${index}] not found` };
    }

    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(100);

    // Focus and click
    element.focus();
    element.click();

    // Dispatch events for better compatibility
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    return {
      success: true,
      action: 'click',
      message: `Clicked element [${index}]`,
      elementInfo: { index, text: element.textContent?.trim().substring(0, 50) },
    };
  }

  private async type(index: number, text: string, clear = true): Promise<ActionResult> {
    const element = this.analyzer.getElement(index) as HTMLInputElement | HTMLTextAreaElement;
    if (!element) {
      return { success: false, action: 'type', message: `Element [${index}] not found` };
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(50);
    element.focus();

    if (clear) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Type character by character for better compatibility
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      await this.delay(10);
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      action: 'type',
      message: `Typed "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}" into element [${index}]`,
      elementInfo: { index },
    };
  }

  private async clear(index: number): Promise<ActionResult> {
    const element = this.analyzer.getElement(index) as HTMLInputElement;
    if (!element) {
      return { success: false, action: 'clear', message: `Element [${index}] not found` };
    }

    element.focus();
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true, action: 'clear', message: `Cleared element [${index}]` };
  }

  private async select(index: number, value: string): Promise<ActionResult> {
    const element = this.analyzer.getElement(index) as HTMLSelectElement;
    if (!element) {
      return { success: false, action: 'select', message: `Element [${index}] not found` };
    }

    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));

    return {
      success: true,
      action: 'select',
      message: `Selected "${value}" in element [${index}]`,
    };
  }

  private scroll(direction: 'up' | 'down' | 'left' | 'right', amount = 300): ActionResult {
    const scrollOptions: ScrollToOptions = { behavior: 'smooth' };
    
    switch (direction) {
      case 'up':
        window.scrollBy({ ...scrollOptions, top: -amount });
        break;
      case 'down':
        window.scrollBy({ ...scrollOptions, top: amount });
        break;
      case 'left':
        window.scrollBy({ ...scrollOptions, left: -amount });
        break;
      case 'right':
        window.scrollBy({ ...scrollOptions, left: amount });
        break;
    }

    return { success: true, action: 'scroll', message: `Scrolled ${direction} by ${amount}px` };
  }

  private async hover(index: number): Promise<ActionResult> {
    const element = this.analyzer.getElement(index) as HTMLElement;
    if (!element) {
      return { success: false, action: 'hover', message: `Element [${index}] not found` };
    }

    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    return { success: true, action: 'hover', message: `Hovered over element [${index}]` };
  }

  private async focus(index: number): Promise<ActionResult> {
    const element = this.analyzer.getElement(index) as HTMLElement;
    if (!element) {
      return { success: false, action: 'focus', message: `Element [${index}] not found` };
    }

    element.focus();
    return { success: true, action: 'focus', message: `Focused element [${index}]` };
  }

  private async wait(ms: number): Promise<ActionResult> {
    await this.delay(ms);
    return { success: true, action: 'wait', message: `Waited ${ms}ms` };
  }

  private navigate(url: string): ActionResult {
    window.location.href = url;
    return { success: true, action: 'navigate', message: `Navigating to ${url}` };
  }

  private goBack(): ActionResult {
    window.history.back();
    return { success: true, action: 'goBack', message: 'Navigated back' };
  }

  private goForward(): ActionResult {
    window.history.forward();
    return { success: true, action: 'goForward', message: 'Navigated forward' };
  }

  private refresh(): ActionResult {
    window.location.reload();
    return { success: true, action: 'refresh', message: 'Page refreshed' };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
