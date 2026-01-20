import { z } from 'zod';

/**
 * DOM Analyzer - Automatically analyzes any webpage and extracts context
 * No configuration needed - works universally on any website
 */
interface InteractiveElement {
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
interface PageContext {
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
interface FormInfo {
    index: number;
    action?: string;
    method?: string;
    fields: FormFieldInfo[];
}
interface FormFieldInfo {
    name: string;
    type: string;
    label?: string;
    placeholder?: string;
    required: boolean;
    elementIndex: number;
}
interface TableInfo {
    index: number;
    headers: string[];
    rowCount: number;
    caption?: string;
}
interface LinkInfo {
    text: string;
    href: string;
    elementIndex: number;
}
interface HeadingInfo {
    level: number;
    text: string;
}
declare class DOMAnalyzer {
    private elementCache;
    private lastAnalysis;
    /**
     * Analyze current page and extract all context
     */
    analyze(): PageContext;
    /**
     * Get element by index for interaction
     */
    getElement(index: number): Element | null;
    /**
     * Generate human-readable description of the page state
     */
    getStateDescription(): string;
    /**
     * Find all interactive elements on the page
     */
    private findInteractiveElements;
    private getElementType;
    private inferRole;
    private getElementText;
    private getXPath;
    private getUniqueSelector;
    private getMetaDescription;
    private getMainTextContent;
    private analyzeForms;
    private analyzeTables;
    private extractLinks;
    private extractHeadings;
}

/**
 * Action Executor - Performs actions on any webpage
 * Automatically handles clicks, typing, scrolling, navigation
 */

type ActionType = 'click' | 'type' | 'clear' | 'select' | 'scroll' | 'hover' | 'focus' | 'wait' | 'navigate' | 'goBack' | 'goForward' | 'refresh' | 'done';
interface ActionParams {
    click: {
        index: number;
    };
    type: {
        index: number;
        text: string;
        clear?: boolean;
    };
    clear: {
        index: number;
    };
    select: {
        index: number;
        value: string;
    };
    scroll: {
        direction: 'up' | 'down' | 'left' | 'right';
        amount?: number;
    };
    hover: {
        index: number;
    };
    focus: {
        index: number;
    };
    wait: {
        ms: number;
    };
    navigate: {
        url: string;
    };
    goBack: Record<string, never>;
    goForward: Record<string, never>;
    refresh: Record<string, never>;
    done: {
        reasoning?: string;
    };
}
interface ActionResult {
    success: boolean;
    action: ActionType;
    message: string;
    error?: string;
    elementInfo?: Partial<InteractiveElement>;
}
declare class ActionExecutor {
    private analyzer;
    constructor(analyzer: DOMAnalyzer);
    execute<T extends ActionType>(action: T, params: ActionParams[T]): Promise<ActionResult>;
    private click;
    private type;
    private clear;
    private select;
    private scroll;
    private hover;
    private focus;
    private wait;
    private navigate;
    private goBack;
    private goForward;
    private refresh;
    private delay;
}

/**
 * WebAgent - Universal AI agent that works on any webpage
 * Just import and use - no configuration needed
 */

interface WebAgentConfig {
    /** LLM API endpoint */
    apiEndpoint?: string;
    /** API key for authentication */
    apiKey?: string;
    /** Model to use (e.g., 'gpt-4', 'claude-3', 'gemini-pro') */
    model?: string;
    /** Custom system prompt */
    systemPrompt?: string;
    /** Enable debug mode */
    debug?: boolean;
    /** Callback when agent performs action */
    onAction?: (action: ActionType, params: unknown, result: ActionResult) => void;
    /** Callback when agent thinks */
    onThink?: (thought: string) => void;
    /** Callback when agent gets page context */
    onContext?: (context: PageContext) => void;
}
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
interface AgentAction {
    action: ActionType;
    params: Record<string, unknown>;
    reasoning: string;
}
declare class WebAgent {
    private analyzer;
    private executor;
    private config;
    private history;
    private isRunning;
    constructor(config?: WebAgentConfig);
    /**
     * Chat with the agent - it will analyze the page and respond
     */
    chat(message: string): Promise<string>;
    /**
     * Execute a task automatically - agent will perform actions until done
     */
    execute(task: string, maxSteps?: number): Promise<ActionResult[]>;
    /**
     * Perform a single action
     */
    act<T extends ActionType>(action: T, params: ActionParams[T]): Promise<ActionResult>;
    /**
     * Get current page context
     */
    getContext(): PageContext;
    /**
     * Get human-readable page description
     */
    getPageDescription(): string;
    /**
     * Stop current execution
     */
    stop(): void;
    /**
     * Clear chat history
     */
    clearHistory(): void;
    private callLLM;
    private mockLLMResponse;
    private parseAction;
    private log;
    private delay;
}

/**
 * LangChainWebAgent - Web Agent built on top of LangChain.js
 * Uses structured output with Zod schema to ensure consistent action format
 */

/**
 * Schema for click action
 */
declare const ClickActionSchema: z.ZodObject<{
    action: z.ZodLiteral<"click">;
    index: z.ZodNumber;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "click";
    index: number;
    reasoning: string;
}, {
    action: "click";
    index: number;
    reasoning: string;
}>;
/**
 * Schema for type/input action
 */
declare const TypeActionSchema: z.ZodObject<{
    action: z.ZodLiteral<"type">;
    index: z.ZodNumber;
    text: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
    action: "type";
    index: number;
    reasoning: string;
}, {
    text: string;
    action: "type";
    index: number;
    reasoning: string;
}>;
/**
 * Schema for select dropdown action
 */
declare const SelectActionSchema: z.ZodObject<{
    action: z.ZodLiteral<"select">;
    index: z.ZodNumber;
    value: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "select";
    index: number;
    value: string;
    reasoning: string;
}, {
    action: "select";
    index: number;
    value: string;
    reasoning: string;
}>;
/**
 * Schema for scroll action
 */
declare const ScrollActionSchema: z.ZodObject<{
    action: z.ZodLiteral<"scroll">;
    direction: z.ZodEnum<["up", "down"]>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "scroll";
    reasoning: string;
    direction: "up" | "down";
}, {
    action: "scroll";
    reasoning: string;
    direction: "up" | "down";
}>;
/**
 * Schema for wait action
 */
declare const WaitActionSchema: z.ZodObject<{
    action: z.ZodLiteral<"wait">;
    ms: z.ZodDefault<z.ZodNumber>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ms: number;
    action: "wait";
    reasoning: string;
}, {
    action: "wait";
    reasoning: string;
    ms?: number | undefined;
}>;
/**
 * Schema for done/complete action
 */
declare const DoneActionSchema: z.ZodObject<{
    action: z.ZodLiteral<"done">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "done";
    reasoning: string;
}, {
    action: "done";
    reasoning: string;
}>;
/**
 * Union schema for all possible actions - LLM must output one of these
 */
declare const WebActionSchema: z.ZodDiscriminatedUnion<"action", [z.ZodObject<{
    action: z.ZodLiteral<"click">;
    index: z.ZodNumber;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "click";
    index: number;
    reasoning: string;
}, {
    action: "click";
    index: number;
    reasoning: string;
}>, z.ZodObject<{
    action: z.ZodLiteral<"type">;
    index: z.ZodNumber;
    text: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
    action: "type";
    index: number;
    reasoning: string;
}, {
    text: string;
    action: "type";
    index: number;
    reasoning: string;
}>, z.ZodObject<{
    action: z.ZodLiteral<"select">;
    index: z.ZodNumber;
    value: z.ZodString;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "select";
    index: number;
    value: string;
    reasoning: string;
}, {
    action: "select";
    index: number;
    value: string;
    reasoning: string;
}>, z.ZodObject<{
    action: z.ZodLiteral<"scroll">;
    direction: z.ZodEnum<["up", "down"]>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "scroll";
    reasoning: string;
    direction: "up" | "down";
}, {
    action: "scroll";
    reasoning: string;
    direction: "up" | "down";
}>, z.ZodObject<{
    action: z.ZodLiteral<"wait">;
    ms: z.ZodDefault<z.ZodNumber>;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    ms: number;
    action: "wait";
    reasoning: string;
}, {
    action: "wait";
    reasoning: string;
    ms?: number | undefined;
}>, z.ZodObject<{
    action: z.ZodLiteral<"done">;
    reasoning: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "done";
    reasoning: string;
}, {
    action: "done";
    reasoning: string;
}>]>;
/**
 * Schema for multiple actions (for form filling, etc.)
 */
declare const WebActionsListSchema: z.ZodObject<{
    actions: z.ZodArray<z.ZodDiscriminatedUnion<"action", [z.ZodObject<{
        action: z.ZodLiteral<"click">;
        index: z.ZodNumber;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        action: "click";
        index: number;
        reasoning: string;
    }, {
        action: "click";
        index: number;
        reasoning: string;
    }>, z.ZodObject<{
        action: z.ZodLiteral<"type">;
        index: z.ZodNumber;
        text: z.ZodString;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        text: string;
        action: "type";
        index: number;
        reasoning: string;
    }, {
        text: string;
        action: "type";
        index: number;
        reasoning: string;
    }>, z.ZodObject<{
        action: z.ZodLiteral<"select">;
        index: z.ZodNumber;
        value: z.ZodString;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        action: "select";
        index: number;
        value: string;
        reasoning: string;
    }, {
        action: "select";
        index: number;
        value: string;
        reasoning: string;
    }>, z.ZodObject<{
        action: z.ZodLiteral<"scroll">;
        direction: z.ZodEnum<["up", "down"]>;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        action: "scroll";
        reasoning: string;
        direction: "up" | "down";
    }, {
        action: "scroll";
        reasoning: string;
        direction: "up" | "down";
    }>, z.ZodObject<{
        action: z.ZodLiteral<"wait">;
        ms: z.ZodDefault<z.ZodNumber>;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        ms: number;
        action: "wait";
        reasoning: string;
    }, {
        action: "wait";
        reasoning: string;
        ms?: number | undefined;
    }>, z.ZodObject<{
        action: z.ZodLiteral<"done">;
        reasoning: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        action: "done";
        reasoning: string;
    }, {
        action: "done";
        reasoning: string;
    }>]>, "many">;
    summary: z.ZodString;
}, "strip", z.ZodTypeAny, {
    summary: string;
    actions: ({
        action: "click";
        index: number;
        reasoning: string;
    } | {
        text: string;
        action: "type";
        index: number;
        reasoning: string;
    } | {
        action: "select";
        index: number;
        value: string;
        reasoning: string;
    } | {
        action: "scroll";
        reasoning: string;
        direction: "up" | "down";
    } | {
        ms: number;
        action: "wait";
        reasoning: string;
    } | {
        action: "done";
        reasoning: string;
    })[];
}, {
    summary: string;
    actions: ({
        action: "click";
        index: number;
        reasoning: string;
    } | {
        text: string;
        action: "type";
        index: number;
        reasoning: string;
    } | {
        action: "select";
        index: number;
        value: string;
        reasoning: string;
    } | {
        action: "scroll";
        reasoning: string;
        direction: "up" | "down";
    } | {
        action: "wait";
        reasoning: string;
        ms?: number | undefined;
    } | {
        action: "done";
        reasoning: string;
    })[];
}>;
type WebAction = z.infer<typeof WebActionSchema>;
type WebActionsList = z.infer<typeof WebActionsListSchema>;
interface LangChainConfig {
    /**
     * LangChain chat model instance
     * Pass in ChatOpenAI, ChatAnthropic, ChatGoogleGenerativeAI, etc.
     */
    model?: unknown;
    /**
     * Or use simple API config (will create ChatOpenAI internally)
     */
    apiEndpoint?: string;
    apiKey?: string;
    modelName?: string;
    /**
     * Enable debug logging
     */
    debug?: boolean;
    /**
     * Callback when action is executed
     */
    onAction?: (action: WebAction, result: ActionResult) => void;
    /**
     * Callback when thinking/reasoning
     */
    onThink?: (thought: string) => void;
    /**
     * Callback for page context updates
     */
    onContext?: (context: PageContext) => void;
    /**
     * Max retries for parsing
     */
    maxRetries?: number;
}
/**
 * LangChain-powered Web Agent with structured output
 */
declare class LangChainWebAgent {
    private analyzer;
    private executor;
    private config;
    private chatModel;
    constructor(config?: LangChainConfig);
    /**
     * Set the LangChain chat model
     * Use this if you want to configure the model separately
     */
    setModel(model: unknown): void;
    /**
     * Get current page context
     */
    getContext(): PageContext;
    /**
     * Get page description for LLM
     */
    getPageDescription(): string;
    /**
     * Execute a single action
     */
    executeAction(action: WebAction): Promise<ActionResult>;
    /**
     * Execute multiple actions in sequence
     */
    executeActions(actions: WebAction[]): Promise<ActionResult[]>;
    /**
     * Chat with the agent using LangChain model
     * Requires @langchain/core to be installed
     */
    chat(message: string): Promise<{
        response: string;
        actions?: WebAction[];
    }>;
    /**
     * Execute a task automatically using LangChain
     */
    execute(task: string, maxSteps?: number): Promise<ActionResult[]>;
    /**
     * Chat using LangChain model with structured output
     */
    private chatWithLangChain;
    /**
     * Simple API call fallback
     */
    private chatWithAPI;
    /**
     * Parse actions from LLM response text
     */
    private parseActionsFromResponse;
    /**
     * Mock response for testing without API
     */
    private mockResponse;
    private log;
}
/**
 * Create agent with OpenAI model
 * Requires @langchain/openai to be installed: npm i @langchain/openai
 */
declare function createOpenAIAgent(apiKey: string, modelName?: string): Promise<LangChainWebAgent>;
/**
 * Create agent with Anthropic Claude model
 * Requires @langchain/anthropic to be installed: npm i @langchain/anthropic
 */
declare function createAnthropicAgent(apiKey: string, modelName?: string): Promise<LangChainWebAgent>;
/**
 * Create agent with Google Gemini model
 * Requires @langchain/google-genai to be installed: npm i @langchain/google-genai
 */
declare function createGeminiAgent(apiKey: string, modelName?: string): Promise<LangChainWebAgent>;
/**
 * Create agent with custom OpenAI-compatible API (like MISA AI)
 */
declare function createCustomAgent(config: {
    apiEndpoint: string;
    apiKey: string;
    modelName?: string;
}): LangChainWebAgent;

/**
 * web-agent-sdk - Universal Web Agent SDK
 * AI-powered browser automation that works on any webpage
 *
 * @example
 * ```typescript
 * import { WebAgent } from 'web-agent-sdk';
 *
 * const agent = new WebAgent({
 *   apiKey: 'your-api-key',
 *   apiEndpoint: 'https://api.openai.com/v1/chat/completions'
 * });
 *
 * // Chat with the agent
 * const response = await agent.chat('What can you see on this page?');
 *
 * // Or execute a task automatically
 * await agent.execute('Fill out the contact form with my info');
 * ```
 */

export { ActionExecutor, type ActionParams, type ActionResult, type ActionType, type AgentAction, type ChatMessage, ClickActionSchema, DOMAnalyzer, DoneActionSchema, type FormInfo, type HeadingInfo, type InteractiveElement, type LangChainConfig, LangChainWebAgent, type LinkInfo, type PageContext, ScrollActionSchema, SelectActionSchema, type TableInfo, TypeActionSchema, WaitActionSchema, type WebAction, WebActionSchema, type WebActionsList, WebActionsListSchema, WebAgent, type WebAgentConfig, createAnthropicAgent, createCustomAgent, createGeminiAgent, createOpenAIAgent, WebAgent as default };
