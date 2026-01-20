'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var zod = require('zod');

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
      headings: this.extractHeadings()
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
    const ctx = this.lastAnalysis || this.analyze();
    let description = `# Page: ${ctx.title}
URL: ${ctx.url}

`;
    if (ctx.description) {
      description += `Description: ${ctx.description}

`;
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
      description += `[${el.index}] ${el.type}: ${truncated}
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
    const classes = Array.from(el.classList).slice(0, 2).join(".");
    if (classes) {
      const selector = `${tag}.${classes}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
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
    element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
    if (clear) {
      element.value = "";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
    for (const char of text) {
      element.value += char;
      element.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keypress", { key: char, bubbles: true }));
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }));
      await this.delay(10);
    }
    element.dispatchEvent(new Event("change", { bubbles: true }));
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
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      success: true,
      action: "select",
      message: `Selected "${value}" in element [${index}]`
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
var ClickActionSchema = zod.z.object({
  action: zod.z.literal("click"),
  index: zod.z.number().describe("The index of the element to click"),
  reasoning: zod.z.string().describe("Why this action is being performed")
});
var TypeActionSchema = zod.z.object({
  action: zod.z.literal("type"),
  index: zod.z.number().describe("The index of the input element"),
  text: zod.z.string().describe("The text to type into the element"),
  reasoning: zod.z.string().describe("Why this action is being performed")
});
var SelectActionSchema = zod.z.object({
  action: zod.z.literal("select"),
  index: zod.z.number().describe("The index of the select element"),
  value: zod.z.string().describe("The value to select"),
  reasoning: zod.z.string().describe("Why this action is being performed")
});
var ScrollActionSchema = zod.z.object({
  action: zod.z.literal("scroll"),
  direction: zod.z.enum(["up", "down"]).describe("Direction to scroll"),
  reasoning: zod.z.string().describe("Why this action is being performed")
});
var WaitActionSchema = zod.z.object({
  action: zod.z.literal("wait"),
  ms: zod.z.number().default(1e3).describe("Milliseconds to wait"),
  reasoning: zod.z.string().describe("Why this action is being performed")
});
var DoneActionSchema = zod.z.object({
  action: zod.z.literal("done"),
  reasoning: zod.z.string().describe("Why the task is considered complete")
});
var WebActionSchema = zod.z.discriminatedUnion("action", [
  ClickActionSchema,
  TypeActionSchema,
  SelectActionSchema,
  ScrollActionSchema,
  WaitActionSchema,
  DoneActionSchema
]);
var WebActionsListSchema = zod.z.object({
  actions: zod.z.array(WebActionSchema).describe("List of actions to perform in order"),
  summary: zod.z.string().describe("Brief summary of what these actions will accomplish")
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
- Output valid JSON only - no markdown, no explanation text outside JSON`;
var LangChainWebAgent = class {
  // Will be typed when LangChain is available
  constructor(config = {}) {
    this.config = {
      debug: false,
      maxRetries: 3,
      ...config
    };
    this.analyzer = new DOMAnalyzer();
    this.executor = new ActionExecutor(this.analyzer);
    this.chatModel = config.model;
  }
  /**
   * Set the LangChain chat model
   * Use this if you want to configure the model separately
   */
  setModel(model) {
    this.chatModel = model;
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
    let result;
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
   * Execute a task automatically using LangChain
   */
  async execute(task, maxSteps = 10) {
    const allResults = [];
    for (let step = 0; step < maxSteps; step++) {
      const { actions } = await this.chat(
        step === 0 ? `Task: ${task}` : `Continue task: ${task}
Previous results: ${allResults.map((r) => r.message).join(", ")}`
      );
      if (!actions || actions.length === 0) {
        this.log("No actions returned");
        break;
      }
      const results = await this.executeActions(actions);
      allResults.push(...results);
      const doneAction = actions.find((a) => a.action === "done");
      if (doneAction) {
        this.log(`Task complete: ${doneAction.reasoning}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    return allResults;
  }
  /**
   * Chat using LangChain model with structured output
   */
  async chatWithLangChain(message, pageContext) {
    try {
      const model = this.chatModel;
      if (model?.withStructuredOutput) {
        const structuredModel = model.withStructuredOutput(WebActionsListSchema);
        const response = await structuredModel.invoke([
          { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
          { role: "user", content: `${pageContext}

User request: ${message}` }
        ]);
        return {
          response: response.summary,
          actions: response.actions
        };
      }
      if (model?.invoke) {
        const response = await model.invoke([
          { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
          { role: "user", content: `${pageContext}

User request: ${message}` }
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
   * Simple API call fallback
   */
  async chatWithAPI(message, pageContext) {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      return this.mockResponse(message);
    }
    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.modelName || "gpt-4",
          messages: [
            { role: "system", content: STRUCTURED_SYSTEM_PROMPT },
            { role: "user", content: `${pageContext}

User request: ${message}` }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      });
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";
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
async function createOpenAIAgent(apiKey, modelName = "gpt-4") {
  try {
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({
      apiKey,
      modelName,
      temperature: 0.3
    });
    return new LangChainWebAgent({ model, debug: true });
  } catch {
    console.warn("@langchain/openai not installed, using API fallback");
    return new LangChainWebAgent({
      apiEndpoint: "https://api.openai.com/v1/chat/completions",
      apiKey,
      modelName,
      debug: true
    });
  }
}
async function createAnthropicAgent(apiKey, modelName = "claude-3-sonnet-20240229") {
  try {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const model = new ChatAnthropic({
      apiKey,
      modelName,
      temperature: 0.3
    });
    return new LangChainWebAgent({ model, debug: true });
  } catch {
    console.warn("@langchain/anthropic not installed");
    return new LangChainWebAgent({ debug: true });
  }
}
async function createGeminiAgent(apiKey, modelName = "gemini-pro") {
  try {
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    const model = new ChatGoogleGenerativeAI({
      apiKey,
      modelName,
      temperature: 0.3
    });
    return new LangChainWebAgent({ model, debug: true });
  } catch {
    console.warn("@langchain/google-genai not installed");
    return new LangChainWebAgent({ debug: true });
  }
}
function createCustomAgent(config) {
  return new LangChainWebAgent({
    apiEndpoint: config.apiEndpoint,
    apiKey: config.apiKey,
    modelName: config.modelName,
    debug: true
  });
}

// src/index.ts
var index_default = WebAgent;

exports.ActionExecutor = ActionExecutor;
exports.ClickActionSchema = ClickActionSchema;
exports.DOMAnalyzer = DOMAnalyzer;
exports.DoneActionSchema = DoneActionSchema;
exports.LangChainWebAgent = LangChainWebAgent;
exports.ScrollActionSchema = ScrollActionSchema;
exports.SelectActionSchema = SelectActionSchema;
exports.TypeActionSchema = TypeActionSchema;
exports.WaitActionSchema = WaitActionSchema;
exports.WebActionSchema = WebActionSchema;
exports.WebActionsListSchema = WebActionsListSchema;
exports.WebAgent = WebAgent;
exports.createAnthropicAgent = createAnthropicAgent;
exports.createCustomAgent = createCustomAgent;
exports.createGeminiAgent = createGeminiAgent;
exports.createOpenAIAgent = createOpenAIAgent;
exports.default = index_default;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map