import { z } from 'zod';

// src/dom/analyzer.ts
var INTERACTIVE_SELECTORS = [
  "a[href]",
  "button",
  'input:not([type="hidden"])',
  "select",
  "textarea",
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
  "[onclick]",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(",");
var DOMAnalyzer = class {
  constructor() {
    this.elementCache = /* @__PURE__ */ new Map();
    this.lastAnalysis = null;
  }
  /**
   * Analyze current page and extract all context
   */
  analyze() {
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
      errors: this.analyzeErrors(elements)
    };
    return this.lastAnalysis;
  }
  /**
   * Get element by index for interaction
   */
  getElement(index) {
    return this.elementCache.get(index) || null;
  }
  /**
   * Generate human-readable description of the page state
   */
  getStateDescription() {
    const ctx = this.analyze();
    let description = `# Page: ${ctx.title}
URL: ${ctx.url}

`;
    if (ctx.description) {
      description += `Description: ${ctx.description}

`;
    }
    if (ctx.errors.length > 0) {
      description += `## \u26A0\uFE0F ERRORS & WARNINGS
`;
      ctx.errors.forEach((err) => {
        const related = err.relatedElementIndex !== void 0 ? ` (related to element [${err.relatedElementIndex}])` : "";
        description += `! ${err.message}${related}
`;
      });
      description += "\n";
    }
    if (ctx.headings.length > 0) {
      description += `## Page Structure
`;
      ctx.headings.slice(0, 10).forEach((h) => {
        description += `${"  ".repeat(h.level - 1)}- ${h.text}
`;
      });
      description += "\n";
    }
    if (ctx.forms.length > 0) {
      description += `## Forms (${ctx.forms.length})
`;
      ctx.forms.forEach((form, i) => {
        description += `Form ${i + 1}:
`;
        form.fields.forEach((field) => {
          const required = field.required ? " (required)" : "";
          description += `  - [${field.elementIndex}] ${field.label || field.name || field.type}${required}
`;
        });
      });
      description += "\n";
    }
    description += `## Interactive Elements (${ctx.elements.length})
`;
    ctx.elements.slice(0, 50).forEach((el) => {
      const label = el.ariaLabel || el.text || el.placeholder || el.name || el.tagName;
      const truncated = label.length > 50 ? label.substring(0, 47) + "..." : label;
      let extra = "";
      if (el.value && el.value !== label && el.value !== "on") {
        extra = ` (value: "${el.value}")`;
      }
      if (el.type.includes("checkbox") || el.type.includes("radio")) {
        extra = el.checked ? " [CHECKED]" : " [UNCHECKED]";
      }
      description += `[${el.index}] ${el.type}: ${truncated}${extra}
`;
    });
    if (ctx.elements.length > 50) {
      description += `... and ${ctx.elements.length - 50} more elements
`;
    }
    return description;
  }
  /**
   * Find all interactive elements on the page
   */
  findInteractiveElements() {
    this.elementCache.clear();
    const elements = [];
    const seen = /* @__PURE__ */ new Set();
    document.querySelectorAll(INTERACTIVE_SELECTORS).forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
      if (!isVisible) return;
      const index = elements.length;
      this.elementCache.set(index, el);
      elements.push({
        index,
        tagName: el.tagName.toLowerCase(),
        type: this.getElementType(el),
        role: el.getAttribute("role") || this.inferRole(el),
        text: this.getElementText(el),
        placeholder: el.placeholder,
        ariaLabel: el.getAttribute("aria-label") || void 0,
        name: el.name || void 0,
        id: el.id || void 0,
        className: el.className || void 0,
        href: el.href || void 0,
        value: el.value || void 0,
        checked: el.checked || false,
        isVisible: true,
        isEnabled: !el.disabled,
        rect,
        xpath: this.getXPath(el),
        selector: this.getUniqueSelector(el)
      });
    });
    return elements;
  }
  getElementType(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
      return `input[${el.type}]`;
    }
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "dropdown";
    if (tag === "textarea") return "textarea";
    return el.getAttribute("role") || tag;
  }
  inferRole(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "input") {
      const type = el.type;
      if (type === "submit" || type === "button") return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      return "textbox";
    }
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    return "generic";
  }
  getElementText(el) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;
    const text = el.textContent?.trim();
    if (text && text.length < 100) return text;
    const value = el.value;
    if (value) return value;
    const placeholder = el.placeholder;
    if (placeholder) return placeholder;
    const title = el.getAttribute("title");
    if (title) return title;
    return el.tagName.toLowerCase();
  }
  getXPath(el) {
    const parts = [];
    let current = el;
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
    return "//" + parts.join("/");
  }
  getUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList).slice(0, 2).map((c) => CSS.escape(c)).join(".");
    if (classes) {
      const selector = `${tag}.${classes}`;
      try {
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      } catch (e) {
      }
    }
    const parent = el.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(el) + 1;
      return `${this.getUniqueSelector(parent)} > ${tag}:nth-child(${index})`;
    }
    return tag;
  }
  getMetaDescription() {
    const meta = document.querySelector('meta[name="description"]');
    return meta?.getAttribute("content") || void 0;
  }
  getMainTextContent() {
    const main = document.querySelector('main, article, [role="main"], .content, #content');
    if (main) {
      return main.textContent?.trim().substring(0, 2e3) || "";
    }
    return document.body.textContent?.trim().substring(0, 2e3) || "";
  }
  analyzeForms(elements) {
    const forms = [];
    document.querySelectorAll("form").forEach((form, index) => {
      const fields = [];
      form.querySelectorAll("input, select, textarea").forEach((field) => {
        const el = field;
        if (el.type === "hidden") return;
        let label = "";
        if (el.id) {
          const labelEl = document.querySelector(`label[for="${el.id}"]`);
          label = labelEl?.textContent?.trim() || "";
        }
        if (!label && el.parentElement?.tagName === "LABEL") {
          label = el.parentElement.textContent?.trim() || "";
        }
        const elementIndex = elements.findIndex(
          (e) => this.elementCache.get(e.index) === field
        );
        fields.push({
          name: el.name || el.id || "",
          type: el.type || el.tagName.toLowerCase(),
          label: label || void 0,
          placeholder: el.placeholder || void 0,
          required: el.required || el.hasAttribute("aria-required"),
          elementIndex
        });
      });
      forms.push({
        index,
        action: form.action || void 0,
        method: form.method || void 0,
        fields
      });
    });
    return forms;
  }
  analyzeTables() {
    const tables = [];
    document.querySelectorAll("table").forEach((table, index) => {
      const headers = [];
      table.querySelectorAll("th").forEach((th) => {
        headers.push(th.textContent?.trim() || "");
      });
      const caption = table.querySelector("caption")?.textContent?.trim();
      const rowCount = table.querySelectorAll("tr").length;
      tables.push({ index, headers, rowCount, caption });
    });
    return tables;
  }
  extractLinks(elements) {
    return elements.filter((el) => el.tagName === "a" && el.href).map((el) => ({
      text: el.text,
      href: el.href,
      elementIndex: el.index
    }));
  }
  extractHeadings() {
    const headings = [];
    document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      const level = parseInt(h.tagName[1]);
      const text = h.textContent?.trim() || "";
      if (text) {
        headings.push({ level, text });
      }
    });
    return headings;
  }
  analyzeErrors(elements) {
    const errors = [];
    const seenMessages = /* @__PURE__ */ new Set();
    const addError = (msg, index) => {
      const key = `${msg}-${index}`;
      if (!seenMessages.has(key)) {
        seenMessages.add(key);
        errors.push({ message: msg, relatedElementIndex: index });
      }
    };
    elements.forEach((el) => {
      const domEl = this.elementCache.get(el.index);
      if (domEl instanceof HTMLInputElement || domEl instanceof HTMLSelectElement || domEl instanceof HTMLTextAreaElement) {
        if (!domEl.validity.valid) {
          addError(`Validation Error: ${domEl.validationMessage}`, el.index);
        }
      }
      if (domEl?.getAttribute("aria-invalid") === "true") {
        const errId = domEl.getAttribute("aria-errormessage");
        let msg = "Invalid input value";
        if (errId) {
          const errEl = document.getElementById(errId);
          if (errEl?.textContent) msg = errEl.textContent.trim();
        }
        addError(msg, el.index);
      }
    });
    document.querySelectorAll('[role="alert"]').forEach((el) => {
      const text = el.textContent?.trim();
      const style = window.getComputedStyle(el);
      if (text && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
        addError(`Alert: ${text}`);
      }
    });
    document.querySelectorAll("span, div, p, label").forEach((el) => {
      if (!el.textContent || el.textContent.length > 100) return;
      const style = window.getComputedStyle(el);
      const color = style.color;
      let isRed = false;
      const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const [_, r, g, b] = rgbMatch.map(Number);
        if (r > 200 && g < 100 && b < 100) {
          isRed = true;
        }
      } else if (color === "red") {
        isRed = true;
      }
      const className = el.className && typeof el.className === "string" ? el.className : "";
      const isErrorClass = className.includes("error") || className.includes("invalid") || className.includes("warning") || className.includes("text-red-");
      if (isRed || isErrorClass) {
        if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
          const text = el.textContent?.trim();
          if (text && text.length > 0) {
            addError(`Possible Error: ${text}`);
          }
        }
      }
    });
    return errors;
  }
};

// src/actions/executor.ts
var ActionExecutor = class {
  constructor(analyzer) {
    this.analyzer = analyzer;
  }
  async execute(action, params) {
    try {
      switch (action) {
        case "click":
          return await this.click(params.index);
        case "type":
          const typeParams = params;
          return await this.type(typeParams.index, typeParams.text, typeParams.clear);
        case "clear":
          return await this.clear(params.index);
        case "select":
          const selectParams = params;
          return await this.select(selectParams.index, selectParams.value);
        case "scroll":
          const scrollParams = params;
          return this.scroll(scrollParams.direction, scrollParams.amount);
        case "hover":
          return await this.hover(params.index);
        case "focus":
          return await this.focus(params.index);
        case "wait":
          return await this.wait(params.ms);
        case "navigate":
          return this.navigate(params.url);
        case "goBack":
          return this.goBack();
        case "goForward":
          return this.goForward();
        case "refresh":
          return this.refresh();
        default:
          return { success: false, action, message: `Unknown action: ${action}` };
      }
    } catch (error) {
      return {
        success: false,
        action,
        message: `Action failed: ${action}`,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  async click(index) {
    const element = this.analyzer.getElement(index);
    if (!element) {
      return { success: false, action: "click", message: `Element [${index}] not found` };
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    await this.delay(100);
    element.focus();
    element.click();
    const tag = element.tagName.toLowerCase();
    if (!["input", "button", "select", "textarea"].includes(tag)) {
      element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    return {
      success: true,
      action: "click",
      message: `Clicked element [${index}]`,
      elementInfo: { index, text: element.textContent?.trim().substring(0, 50) }
    };
  }
  async type(index, text, clear = true) {
    const element = this.analyzer.getElement(index);
    if (!element) {
      return { success: false, action: "type", message: `Element [${index}] not found` };
    }
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    await this.delay(50);
    element.focus();
    const inputType = element.getAttribute("type") || "text";
    const directValueTypes = ["date", "time", "datetime-local", "month", "week", "color", "range", "hidden"];
    if (inputType === "checkbox" || inputType === "radio") {
      const shouldCheck = ["true", "yes", "on", "1", "checked"].includes(text.toLowerCase());
      element.checked = shouldCheck;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return {
        success: true,
        action: "type",
        message: `${shouldCheck ? "Checked" : "Unchecked"} ${inputType} element [${index}]`,
        elementInfo: { index }
      };
    }
    if (directValueTypes.includes(inputType)) {
      element.value = text;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        success: true,
        action: "type",
        message: `Set value "${text}" for ${inputType} element [${index}]`,
        elementInfo: { index }
      };
    }
    if (clear) {
      element.value = "";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (clear) {
      element.value = text;
    } else {
      element.value += text;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    if (text.length > 0) {
      const lastChar = text[text.length - 1];
      element.dispatchEvent(new KeyboardEvent("keydown", { key: lastChar, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keyup", { key: lastChar, bubbles: true }));
    }
    return {
      success: true,
      action: "type",
      message: `Typed "${text.substring(0, 30)}${text.length > 30 ? "..." : ""}" into element [${index}]`,
      elementInfo: { index }
    };
  }
  async clear(index) {
    const element = this.analyzer.getElement(index);
    if (!element) {
      return { success: false, action: "clear", message: `Element [${index}] not found` };
    }
    element.focus();
    element.value = "";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { success: true, action: "clear", message: `Cleared element [${index}]` };
  }
  async select(index, value) {
    const element = this.analyzer.getElement(index);
    if (!element) {
      return { success: false, action: "select", message: `Element [${index}] not found` };
    }
    const options = Array.from(element.options);
    let matchedOption = options.find((opt) => opt.value === value);
    if (!matchedOption) {
      matchedOption = options.find((opt) => opt.value.toLowerCase() === value.toLowerCase());
    }
    if (!matchedOption) {
      matchedOption = options.find((opt) => opt.text === value);
    }
    if (!matchedOption) {
      matchedOption = options.find((opt) => opt.text.toLowerCase() === value.toLowerCase());
    }
    if (!matchedOption) {
      matchedOption = options.find((opt) => opt.text.toLowerCase().includes(value.toLowerCase()));
    }
    if (matchedOption) {
      element.value = matchedOption.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return {
        success: true,
        action: "select",
        message: `Selected "${matchedOption.text}" (value: ${matchedOption.value}) in element [${index}]`
      };
    }
    return {
      success: false,
      action: "select",
      message: `Option "${value}" not found in element [${index}]. Available: ${options.map((o) => o.text).join(", ")}`
    };
  }
  scroll(direction, amount = 300) {
    const scrollOptions = { behavior: "smooth" };
    switch (direction) {
      case "up":
        window.scrollBy({ ...scrollOptions, top: -amount });
        break;
      case "down":
        window.scrollBy({ ...scrollOptions, top: amount });
        break;
      case "left":
        window.scrollBy({ ...scrollOptions, left: -amount });
        break;
      case "right":
        window.scrollBy({ ...scrollOptions, left: amount });
        break;
    }
    return { success: true, action: "scroll", message: `Scrolled ${direction} by ${amount}px` };
  }
  async hover(index) {
    const element = this.analyzer.getElement(index);
    if (!element) {
      return { success: false, action: "hover", message: `Element [${index}] not found` };
    }
    element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    return { success: true, action: "hover", message: `Hovered over element [${index}]` };
  }
  async focus(index) {
    const element = this.analyzer.getElement(index);
    if (!element) {
      return { success: false, action: "focus", message: `Element [${index}] not found` };
    }
    element.focus();
    return { success: true, action: "focus", message: `Focused element [${index}]` };
  }
  async wait(ms) {
    await this.delay(ms);
    return { success: true, action: "wait", message: `Waited ${ms}ms` };
  }
  navigate(url) {
    window.location.href = url;
    return { success: true, action: "navigate", message: `Navigating to ${url}` };
  }
  goBack() {
    window.history.back();
    return { success: true, action: "goBack", message: "Navigated back" };
  }
  goForward() {
    window.history.forward();
    return { success: true, action: "goForward", message: "Navigated forward" };
  }
  refresh() {
    window.location.reload();
    return { success: true, action: "refresh", message: "Page refreshed" };
  }
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// src/agent/web-agent.ts
var DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant that can interact with web pages.
You analyze the page context and perform actions to help the user accomplish their goals.

When given a task, you should:
1. Analyze the current page state
2. Decide what action to take
3. Return the action in JSON format

Available actions:
- click: { "action": "click", "params": { "index": <element_index> }, "reasoning": "why" }
- type: { "action": "type", "params": { "index": <element_index>, "text": "..." }, "reasoning": "why" }
- select: { "action": "select", "params": { "index": <element_index>, "value": "..." }, "reasoning": "why" }
- scroll: { "action": "scroll", "params": { "direction": "up|down" }, "reasoning": "why" }
- wait: { "action": "wait", "params": { "ms": 1000 }, "reasoning": "why" }
- done: { "action": "done", "reasoning": "task completed because..." }

Always respond with valid JSON. Use element indices from the page context.`;
var WebAgent = class {
  constructor(config = {}) {
    this.history = [];
    this.isRunning = false;
    this.config = {
      model: "gpt-4",
      debug: false,
      ...config
    };
    this.analyzer = new DOMAnalyzer();
    this.executor = new ActionExecutor(this.analyzer);
  }
  /**
   * Chat with the agent - it will analyze the page and respond
   */
  async chat(message) {
    this.history.push({ role: "user", content: message });
    const context = this.analyzer.analyze();
    this.config.onContext?.(context);
    const stateDescription = this.analyzer.getStateDescription();
    const prompt = `Current page state:
${stateDescription}

User request: ${message}`;
    const response = await this.callLLM(prompt);
    this.history.push({ role: "assistant", content: response });
    return response;
  }
  /**
   * Execute a task automatically - agent will perform actions until done
   */
  async execute(task, maxSteps = 10) {
    if (this.isRunning) {
      throw new Error("Agent is already running");
    }
    this.isRunning = true;
    const results = [];
    try {
      for (let step = 0; step < maxSteps; step++) {
        const context = this.analyzer.analyze();
        this.config.onContext?.(context);
        const stateDescription = this.analyzer.getStateDescription();
        const prompt = step === 0 ? `Task: ${task}

Current page:
${stateDescription}

What action should I take first?` : `Task: ${task}

Current page:
${stateDescription}

Previous actions: ${results.map((r) => r.message).join(", ")}

What action should I take next?`;
        const response = await this.callLLM(prompt);
        this.config.onThink?.(response);
        const action = this.parseAction(response);
        if (!action) {
          this.log("Could not parse action from response");
          break;
        }
        if (action.action === "done") {
          this.log("Task completed: " + action.reasoning);
          break;
        }
        const result = await this.executor.execute(
          action.action,
          action.params
        );
        results.push(result);
        this.config.onAction?.(action.action, action.params, result);
        this.log(`Action: ${result.message}`);
        await this.delay(500);
      }
    } finally {
      this.isRunning = false;
    }
    return results;
  }
  /**
   * Perform a single action
   */
  async act(action, params) {
    const result = await this.executor.execute(action, params);
    this.config.onAction?.(action, params, result);
    return result;
  }
  /**
   * Get current page context
   */
  getContext() {
    return this.analyzer.analyze();
  }
  /**
   * Get human-readable page description
   */
  getPageDescription() {
    return this.analyzer.getStateDescription();
  }
  /**
   * Stop current execution
   */
  stop() {
    this.isRunning = false;
  }
  /**
   * Clear chat history
   */
  clearHistory() {
    this.history = [];
  }
  async callLLM(prompt) {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      return this.mockLLMResponse(prompt);
    }
    const messages = [
      { role: "system", content: this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ...this.history,
      { role: "user", content: prompt }
    ];
    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0.7
        })
      });
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "No response";
    } catch (error) {
      this.log("LLM API error: " + (error instanceof Error ? error.message : error));
      throw error;
    }
  }
  mockLLMResponse(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes("click") && lowerPrompt.includes("button")) {
      return '{"action": "click", "params": {"index": 0}, "reasoning": "Clicking the first button"}';
    }
    if (lowerPrompt.includes("search") || lowerPrompt.includes("type")) {
      return '{"action": "type", "params": {"index": 0, "text": "test"}, "reasoning": "Typing in search field"}';
    }
    if (lowerPrompt.includes("scroll")) {
      return '{"action": "scroll", "params": {"direction": "down"}, "reasoning": "Scrolling to see more content"}';
    }
    return '{"action": "done", "reasoning": "I analyzed the page. What would you like me to do?"}';
  }
  parseAction(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.log("Failed to parse action JSON");
    }
    return null;
  }
  log(message) {
    if (this.config.debug) {
      console.log(`[WebAgent] ${message}`);
    }
  }
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};
var ClickActionSchema = z.object({
  action: z.literal("click"),
  index: z.number().describe("The index of the element to click"),
  reasoning: z.string().describe("Why this action is being performed")
});
var TypeActionSchema = z.object({
  action: z.literal("type"),
  index: z.number().describe("The index of the input element"),
  text: z.string().describe("The text to type into the element"),
  reasoning: z.string().describe("Why this action is being performed")
});
var SelectActionSchema = z.object({
  action: z.literal("select"),
  index: z.number().describe("The index of the select element"),
  value: z.string().describe("The value to select"),
  reasoning: z.string().describe("Why this action is being performed")
});
var ScrollActionSchema = z.object({
  action: z.literal("scroll"),
  direction: z.enum(["up", "down"]).describe("Direction to scroll"),
  reasoning: z.string().describe("Why this action is being performed")
});
var WaitActionSchema = z.object({
  action: z.literal("wait"),
  ms: z.number().default(1e3).describe("Milliseconds to wait"),
  reasoning: z.string().describe("Why this action is being performed")
});
var DoneActionSchema = z.object({
  action: z.literal("done"),
  reasoning: z.string().describe("Why the task is considered complete")
});
var WebActionSchema = z.discriminatedUnion("action", [
  ClickActionSchema,
  TypeActionSchema,
  SelectActionSchema,
  ScrollActionSchema,
  WaitActionSchema,
  DoneActionSchema
]);
var WebActionsListSchema = z.object({
  actions: z.array(WebActionSchema).describe("List of actions to perform in order"),
  summary: z.string().describe("Brief summary of what these actions will accomplish")
});
var STRUCTURED_SYSTEM_PROMPT = `You are a Web Agent AI assistant. Your job is to interact with web pages by outputting structured actions.

CRITICAL: You MUST respond with valid JSON that matches the expected schema.

PAGE ELEMENTS are identified by their [index] number. Use this index in your actions.

AVAILABLE ACTIONS:
1. click - Click on an element
   {"action": "click", "index": 0, "reasoning": "..."}

2. type - Enter text into an input field  
   {"action": "type", "index": 0, "text": "Hello", "reasoning": "..."}

3. select - Choose option in a dropdown
   {"action": "select", "index": 0, "value": "option1", "reasoning": "..."}

4. scroll - Scroll the page
   {"action": "scroll", "direction": "down", "reasoning": "..."}

5. wait - Wait for something to load
   {"action": "wait", "ms": 1000, "reasoning": "..."}

6. done - Task is complete
   {"action": "done", "reasoning": "..."}

For MULTIPLE ACTIONS (like filling a form), respond with:
{
  "actions": [
    {"action": "type", "index": 0, "text": "John", "reasoning": "Fill name field"},
    {"action": "type", "index": 1, "text": "john@email.com", "reasoning": "Fill email"},
    {"action": "click", "index": 2, "reasoning": "Submit form"}
  ],
  "summary": "Fill and submit the contact form"
}

RULES:
- Always use element index from the page context
- Always include reasoning for your actions
- Pay attention to ERRORS & WARNINGS in the page state. If validation errors are present, fix them before proceeding.
- Output valid JSON only - no markdown, no explanation text outside JSON`;
var LangChainWebAgent = class {
  constructor(config = {}) {
    // Will be typed when LangChain is available
    this.history = [];
    this.results = [];
    this.lastAction = null;
    this.config = {
      debug: false,
      maxRetries: 3,
      useStructuredOutput: true,
      ...config
    };
    this.analyzer = new DOMAnalyzer();
    this.executor = new ActionExecutor(this.analyzer);
    this.chatModel = config.model;
  }
  /**
   * Export current agent state
   */
  exportState() {
    return JSON.stringify({
      history: this.history,
      results: this.results
    });
  }
  /**
   * Import agent state
   */
  importState(stateJson) {
    try {
      const state = JSON.parse(stateJson);
      this.history = state.history || [];
      this.results = state.results || [];
    } catch (e) {
      this.log(`Error importing state: ${e}`);
    }
  }
  /**
   * Set the LangChain chat model
   * Use this if you want to configure the model separately
   */
  setModel(model) {
    this.chatModel = model;
  }
  /**
   * Update the agent's skills configuration
   */
  setSkills(skills) {
    this.config.skills = skills;
  }
  /**
   * Get current page context
   */
  getContext() {
    const context = this.analyzer.analyze();
    this.config.onContext?.(context);
    return context;
  }
  /**
   * Get page description for LLM
   */
  getPageDescription() {
    return this.analyzer.getStateDescription();
  }
  /**
   * Execute a single action
   */
  async executeAction(action) {
    if (this.lastAction && action.action !== "scroll" && action.action !== "wait") {
      const cleanA = { ...action, reasoning: "" };
      const cleanB = { ...this.lastAction, reasoning: "" };
      if (JSON.stringify(cleanA) === JSON.stringify(cleanB)) {
        const loopMsg = `Loop detected: You just performed this exact action (${action.action}). Try something else.`;
        this.log(loopMsg);
        return { success: false, action: action.action, message: loopMsg };
      }
    }
    this.lastAction = action;
    this.history.push(`Action: ${action.action} (executing)`);
    this.config.onActionStart?.(action);
    let result;
    try {
      switch (action.action) {
        case "click":
          result = await this.executor.execute("click", { index: action.index });
          break;
        case "type":
          result = await this.executor.execute("type", { index: action.index, text: action.text });
          break;
        case "select":
          result = await this.executor.execute("select", { index: action.index, value: action.value });
          break;
        case "scroll":
          result = await this.executor.execute("scroll", { direction: action.direction });
          break;
        case "wait":
          await new Promise((r) => setTimeout(r, action.ms || 1e3));
          result = { success: true, action: "wait", message: `Waited ${action.ms || 1e3}ms` };
          break;
        case "done":
          result = { success: true, action: "done", message: action.reasoning };
          break;
        default:
          result = { success: false, action: "wait", message: "Unknown action" };
      }
    } catch (e) {
      result = { success: false, action: action.action, message: `Failed: ${e}` };
    }
    this.history[this.history.length - 1] = `Action: ${action.action} (${result.message})`;
    this.results.push(result);
    this.config.onAction?.(action, result);
    this.log(`Action: ${action.action} - ${result.message}`);
    return result;
  }
  /**
   * Execute multiple actions in sequence
   */
  async executeActions(actions) {
    const results = [];
    for (const action of actions) {
      const result = await this.executeAction(action);
      results.push(result);
      if (!result.success || action.action === "done") {
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    return results;
  }
  /**
   * Chat with the agent using LangChain model
   * Requires @langchain/core to be installed
   */
  async chat(message) {
    const pageContext = this.getPageDescription();
    if (this.chatModel) {
      return this.chatWithLangChain(message, pageContext);
    }
    return this.chatWithAPI(message, pageContext);
  }
  /**
   * Execute a task automatically using Planner-Actor architecture
   */
  async execute(task, maxSteps = 10, resume = false) {
    if (!resume) {
      this.results = [];
      this.history = [];
    }
    const startStep = this.results.length > 0 ? Math.floor(this.history.length / 2) : 0;
    for (let step = startStep; step < maxSteps; step++) {
      const pageContext = this.getPageDescription();
      this.log(`Planning step ${step + 1}`);
      let urgencyInstruction = "";
      if (maxSteps - step <= 3) {
        urgencyInstruction = `

CRITICAL WARNING: You have ${maxSteps - step} steps remaining. You MUST conclude the task immediately. If you cannot finish, output "DONE: <summary of what was achieved and what failed>". Do NOT start new exploration actions.`;
      }
      try {
        const plannerSystemPrompt = `You are a Browser Agent Planner.
Your goal is to complete the user's task on the current page.
${urgencyInstruction}

1. CRITICAL: CHECK FOR SUCCESS FIRST.
   - Look for "Thank you", "Order confirmed", "Success", or similar messages.
   - Look for success modals or redirect pages.
   - If success is detected, output exactly: "DONE". IGNORE any validation errors if the task is already done.

2. Analyze the PAGE STATE (especially ERRORS & WARNINGS section) and ACTION HISTORY.

3. CHECK FOR ERRORS: If there are validation errors or warnings AND the task is NOT done, your next step MUST be to fix them. Do not keep submitting if there are errors.

4. If NOT COMPLETED and NO ERRORS, provide the NEXT STEP. 
   - Group related actions together (e.g. "Fill all form fields", "Enter details and click submit").
   - Do not break down into single clicks unless necessary.

5. AMBIGUITY CHECK: If the user request is unclear, ambiguous, or missing critical information, output: "ASK: <your question>". IMPORTANT: Do not make up information.

6. INTERACTIVE COMPLETION: If the task is DONE, instead of just "DONE", you can output "DONE: <summary>". You can also ask what the user wants to do next.

7. ANY INFORMATION MISSING: If you lack critical information to proceed (e.g. user details, payment info), output: "ASK: <your question>". IMPORTANT: Do not make up information.

8. ALWAYS keep the USER REQUEST in mind when planning your steps.

9. IMPORTANT: NEVER perform actions that would SUBMIT or FINALIZE transactions without explicit instruction.

Task: ${task}

${this.config.skills ? `ADDITIONAL SKILLS/INSTRUCTIONS:
${this.config.skills}` : ""}`;
        const plannerUserContent = `PAGE STATE:
${pageContext}

ACTION HISTORY:
${this.history.join("\n")}

What is the next step?`;
        let plan = "";
        if (this.chatModel) {
          const planResponse = await this.chatModel.invoke([
            ["system", plannerSystemPrompt],
            ["human", plannerUserContent]
          ]);
          plan = planResponse.content.toString().trim();
        } else {
          plan = await this.callAPI([
            { role: "system", content: plannerSystemPrompt },
            { role: "user", content: plannerUserContent }
          ], false);
        }
        this.log(`Plan: ${plan}`);
        if (plan.startsWith("ASK:")) {
          this.log(`Agent Question: ${plan.substring(4).trim()}`);
          break;
        }
        if (plan.toUpperCase().startsWith("DONE") || plan.includes("successfully booked")) {
          this.log("Task verified as complete");
          this.history.push(`Completion: ${plan}`);
          if (plan.length > 4) {
            this.log(plan.substring(5).trim());
          }
          break;
        }
        const { actions, response } = await this.chat(`Original Task Context: ${task}

Execute this step: ${plan}`);
        if (actions && actions.length > 0) {
          await this.executeActions(actions);
        } else {
          this.history.push(`Observation: ${response}`);
        }
        await new Promise((r) => setTimeout(r, 1e3));
      } catch (error) {
        this.log(`Planning error: ${error}`);
        break;
      }
    }
    return this.results;
  }
  /**
   * Simple ReAct execution loop (Legacy/Fallback)
   */
  async executeSimple(task, maxSteps = 10) {
    const allResults = [];
    const history = [];
    for (let step = 0; step < maxSteps; step++) {
      const pageContext = this.getPageDescription();
      this.log(`Planning step ${step + 1}`);
      try {
        const planResponse = await this.chatModel.invoke([
          ["system", `You are a Browser Agent Planner.
Your goal is to complete the user's task on the current page.
1. Analyze the PAGE STATE and ACTION HISTORY.
2. VERIFY if the task is already completed based on the state (e.g. success message visible, data updated).
3. If COMPLETED, output exactly: "DONE"
4. If NOT COMPLETED, provide the NEXT STEP. 
   - Group related actions together (e.g. "Fill all form fields", "Enter details and click submit").
   - Do not break down into single clicks unless necessary.

Task: ${task}

${this.config.skills ? `ADDITIONAL SKILLS/INSTRUCTIONS:
${this.config.skills}` : ""}`],
          ["human", `PAGE STATE:
${pageContext}

ACTION HISTORY:
${history.join("\n")}

What is the next step?`]
        ]);
        const plan = planResponse.content.toString().trim();
        this.log(`Plan: ${plan}`);
        if (plan.toUpperCase().startsWith("DONE") || plan.includes("successfully booked")) {
          this.log("Task verified as complete");
          break;
        }
        const { actions, response } = await this.chat(`Original Task Context: ${task}

Execute this step: ${plan}`);
        if (actions && actions.length > 0) {
          const results = await this.executeActions(actions);
          allResults.push(...results);
          results.forEach((r) => history.push(`Action: ${r.action} (${r.message})`));
        } else {
          history.push(`Observation: ${response}`);
        }
        await new Promise((r) => setTimeout(r, 1e3));
      } catch (error) {
        this.log(`Planning error: ${error}`);
        return this.executeSimple(task, maxSteps - step);
      }
    }
    return allResults;
  }
  /**
   * Chat using LangChain model with structured output
   */
  async chatWithLangChain(message, pageContext) {
    try {
      const model = this.chatModel;
      if (this.config.useStructuredOutput && model?.withStructuredOutput) {
        try {
          const structuredModel = model.withStructuredOutput(WebActionsListSchema);
          const response = await structuredModel.invoke([
            ["system", `${STRUCTURED_SYSTEM_PROMPT}

${this.config.skills ? `ADDITIONAL SKILLS:
${this.config.skills}` : ""}`],
            ["human", `${pageContext}

User request: ${message}`]
          ]);
          return {
            response: response.summary,
            actions: response.actions
          };
        } catch (e) {
          this.log(`Structured output failed, falling back to prompt engineering: ${e}`);
        }
      }
      if (model?.invoke) {
        const response = await model.invoke([
          ["system", `${STRUCTURED_SYSTEM_PROMPT}

${this.config.skills ? `ADDITIONAL SKILLS:
${this.config.skills}` : ""}`],
          ["human", `${pageContext}

User request: ${message}`]
        ]);
        const parsed = this.parseActionsFromResponse(response.content);
        return {
          response: parsed.summary || response.content,
          actions: parsed.actions
        };
      }
    } catch (error) {
      this.log(`LangChain error: ${error}`);
    }
    return { response: "LangChain model not properly configured" };
  }
  /**
   * Helper to call API endpoint
   */
  async callAPI(messages, jsonMode = false) {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      throw new Error("API config missing");
    }
    const response = await fetch(this.config.apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.modelName || "gpt-4",
        messages,
        temperature: 0.3,
        max_tokens: this.config.maxTokens,
        ...jsonMode ? { response_format: { type: "json_object" } } : {}
      })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  }
  /**
   * Simple API call fallback
   */
  async chatWithAPI(message, pageContext) {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      return this.mockResponse(message);
    }
    try {
      const content = await this.callAPI([
        { role: "system", content: `${STRUCTURED_SYSTEM_PROMPT}

${this.config.skills ? `ADDITIONAL SKILLS:
${this.config.skills}` : ""}` },
        { role: "user", content: `${pageContext}

User request: ${message}` }
      ], true);
      const parsed = this.parseActionsFromResponse(content);
      return {
        response: parsed.summary || content,
        actions: parsed.actions
      };
    } catch (error) {
      this.log(`API error: ${error}`);
      return { response: `Error: ${error}` };
    }
  }
  /**
   * Parse actions from LLM response text
   */
  parseActionsFromResponse(response) {
    for (let retry = 0; retry < (this.config.maxRetries || 3); retry++) {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.actions && Array.isArray(parsed.actions)) {
          const validated = WebActionsListSchema.safeParse(parsed);
          if (validated.success) {
            return validated.data;
          }
        }
        const singleValidated = WebActionSchema.safeParse(parsed);
        if (singleValidated.success) {
          return {
            summary: singleValidated.data.reasoning,
            actions: [singleValidated.data]
          };
        }
      } catch (e) {
        this.log(`Parse attempt ${retry + 1} failed`);
      }
    }
    return {};
  }
  /**
   * Mock response for testing without API
   */
  mockResponse(message) {
    const lower = message.toLowerCase();
    if (lower.includes("\u0111i\u1EC1n form") || lower.includes("fill form")) {
      return {
        response: "\u0110i\u1EC1n form v\u1EDBi th\xF4ng tin test",
        actions: [
          { action: "type", index: 0, text: "Nguy\u1EC5n V\u0103n A", reasoning: "\u0110i\u1EC1n h\u1ECD t\xEAn" },
          { action: "type", index: 1, text: "test@example.com", reasoning: "\u0110i\u1EC1n email" },
          { action: "type", index: 2, text: "0901234567", reasoning: "\u0110i\u1EC1n S\u0110T" },
          { action: "select", index: 3, value: "support", reasoning: "Ch\u1ECDn ch\u1EE7 \u0111\u1EC1" },
          { action: "type", index: 4, text: "Tin nh\u1EAFn test", reasoning: "\u0110i\u1EC1n n\u1ED9i dung" }
        ]
      };
    }
    if (lower.includes("click") || lower.includes("submit") || lower.includes("g\u1EEDi")) {
      return {
        response: "Click v\xE0o n\xFAt",
        actions: [{ action: "click", index: 5, reasoning: "Click submit button" }]
      };
    }
    return {
      response: "Ph\xE2n t\xEDch trang th\xE0nh c\xF4ng",
      actions: [{ action: "done", reasoning: "\u0110\xE3 ph\xE2n t\xEDch xong trang web" }]
    };
  }
  log(message) {
    if (this.config.debug) {
      console.log(`[LangChainWebAgent] ${message}`);
    }
    this.config.onThink?.(message);
  }
};
async function createOpenAIAgent(apiKey, modelName = "gpt-4", options = {}) {
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({
      apiKey,
      modelName,
      temperature: 0.3,
      maxTokens: options.maxTokens
    });
    return new LangChainWebAgent({ model, debug: true, ...options });
  } catch {
    console.warn("@langchain/openai not installed, using API fallback");
    return new LangChainWebAgent({
      apiEndpoint: "https://api.openai.com/v1/chat/completions",
      apiKey,
      modelName,
      debug: true,
      ...options
    });
  }
}
async function createAnthropicAgent(apiKey, modelName = "claude-3-sonnet-20240229", options = {}) {
  try {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const model = new ChatAnthropic({
      apiKey,
      modelName,
      temperature: 0.3,
      maxTokens: options.maxTokens
    });
    return new LangChainWebAgent({ model, debug: true, ...options });
  } catch {
    console.warn("@langchain/anthropic not installed");
    return new LangChainWebAgent({ debug: true, ...options });
  }
}
async function createGeminiAgent(apiKey, modelName = "gemini-pro", options = {}) {
  try {
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    const model = new ChatGoogleGenerativeAI({
      apiKey,
      model: modelName,
      temperature: 0.3,
      maxOutputTokens: options.maxTokens
    });
    return new LangChainWebAgent({ model, debug: true, useStructuredOutput: false, ...options });
  } catch {
    console.warn("@langchain/google-genai not installed");
    return new LangChainWebAgent({ debug: true, ...options });
  }
}
async function createCustomAgent(config, options = {}) {
  const baseUrl = config.baseURL || config.apiEndpoint;
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({
      apiKey: config.apiKey,
      modelName: config.modelName,
      configuration: {
        baseURL: baseUrl
      },
      temperature: 0,
      maxTokens: options.maxTokens
    });
    return new LangChainWebAgent({ model, debug: true, ...options });
  } catch {
    console.warn("@langchain/openai not installed, using API fallback (No Planner support)");
    return new LangChainWebAgent({
      apiEndpoint: baseUrl,
      apiKey: config.apiKey,
      modelName: config.modelName,
      debug: true,
      ...options
    });
  }
}

// src/index.ts
var index_default = WebAgent;

export { ActionExecutor, ClickActionSchema, DOMAnalyzer, DoneActionSchema, LangChainWebAgent, ScrollActionSchema, SelectActionSchema, TypeActionSchema, WaitActionSchema, WebActionSchema, WebActionsListSchema, WebAgent, createAnthropicAgent, createCustomAgent, createGeminiAgent, createOpenAIAgent, index_default as default };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map