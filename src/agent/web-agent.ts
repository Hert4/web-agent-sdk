/**
 * WebAgent - Universal AI agent that works on any webpage
 * Just import and use - no configuration needed
 */

import { DOMAnalyzer, type PageContext } from '../dom/analyzer';
import { ActionExecutor, type ActionType, type ActionParams, type ActionResult } from '../actions/executor';

export interface WebAgentConfig {
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

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentAction {
  action: ActionType;
  params: Record<string, unknown>;
  reasoning: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant that can interact with web pages.
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

export class WebAgent {
  private analyzer: DOMAnalyzer;
  private executor: ActionExecutor;
  private config: WebAgentConfig;
  private history: ChatMessage[] = [];
  private isRunning = false;

  constructor(config: WebAgentConfig = {}) {
    this.config = {
      model: 'gpt-4',
      debug: false,
      ...config,
    };
    this.analyzer = new DOMAnalyzer();
    this.executor = new ActionExecutor(this.analyzer);
  }

  /**
   * Chat with the agent - it will analyze the page and respond
   */
  async chat(message: string): Promise<string> {
    // Add user message
    this.history.push({ role: 'user', content: message });

    // Analyze current page
    const context = this.analyzer.analyze();
    this.config.onContext?.(context);

    // Build prompt with page context
    const stateDescription = this.analyzer.getStateDescription();
    const prompt = `Current page state:\n${stateDescription}\n\nUser request: ${message}`;

    // Get LLM response
    const response = await this.callLLM(prompt);
    
    // Add assistant response
    this.history.push({ role: 'assistant', content: response });

    return response;
  }

  /**
   * Execute a task automatically - agent will perform actions until done
   */
  async execute(task: string, maxSteps = 10): Promise<ActionResult[]> {
    if (this.isRunning) {
      throw new Error('Agent is already running');
    }

    this.isRunning = true;
    const results: ActionResult[] = [];

    try {
      for (let step = 0; step < maxSteps; step++) {
        // Analyze page
        const context = this.analyzer.analyze();
        this.config.onContext?.(context);

        // Get next action from LLM
        const stateDescription = this.analyzer.getStateDescription();
        const prompt = step === 0
          ? `Task: ${task}\n\nCurrent page:\n${stateDescription}\n\nWhat action should I take first?`
          : `Task: ${task}\n\nCurrent page:\n${stateDescription}\n\nPrevious actions: ${results.map(r => r.message).join(', ')}\n\nWhat action should I take next?`;

        const response = await this.callLLM(prompt);
        this.config.onThink?.(response);

        // Parse action from response
        const action = this.parseAction(response);
        
        if (!action) {
          this.log('Could not parse action from response');
          break;
        }

        if (action.action === 'done') {
          this.log('Task completed: ' + action.reasoning);
          break;
        }

        // Execute action
        const result = await this.executor.execute(
          action.action as ActionType,
          action.params as ActionParams[ActionType]
        );
        
        results.push(result);
        this.config.onAction?.(action.action as ActionType, action.params, result);
        this.log(`Action: ${result.message}`);

        // Wait for page to update
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
  async act<T extends ActionType>(action: T, params: ActionParams[T]): Promise<ActionResult> {
    const result = await this.executor.execute(action, params);
    this.config.onAction?.(action, params, result);
    return result;
  }

  /**
   * Get current page context
   */
  getContext(): PageContext {
    return this.analyzer.analyze();
  }

  /**
   * Get human-readable page description
   */
  getPageDescription(): string {
    return this.analyzer.getStateDescription();
  }

  /**
   * Stop current execution
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Clear chat history
   */
  clearHistory(): void {
    this.history = [];
  }

  private async callLLM(prompt: string): Promise<string> {
    // If no API endpoint, return mock response for testing
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      return this.mockLLMResponse(prompt);
    }

    const messages = [
      { role: 'system', content: this.config.systemPrompt || DEFAULT_SYSTEM_PROMPT },
      ...this.history,
      { role: 'user', content: prompt },
    ];

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: 0.7,
        }),
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'No response';
    } catch (error) {
      this.log('LLM API error: ' + (error instanceof Error ? error.message : error));
      throw error;
    }
  }

  private mockLLMResponse(prompt: string): string {
    // Simple mock for testing without API
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('click') && lowerPrompt.includes('button')) {
      return '{"action": "click", "params": {"index": 0}, "reasoning": "Clicking the first button"}';
    }
    if (lowerPrompt.includes('search') || lowerPrompt.includes('type')) {
      return '{"action": "type", "params": {"index": 0, "text": "test"}, "reasoning": "Typing in search field"}';
    }
    if (lowerPrompt.includes('scroll')) {
      return '{"action": "scroll", "params": {"direction": "down"}, "reasoning": "Scrolling to see more content"}';
    }
    
    return '{"action": "done", "reasoning": "I analyzed the page. What would you like me to do?"}';
  }

  private parseAction(response: string): AgentAction | null {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.log('Failed to parse action JSON');
    }
    return null;
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[WebAgent] ${message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
