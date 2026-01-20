/**
 * LangChainWebAgent - Web Agent built on top of LangChain.js
 * Uses structured output with Zod schema to ensure consistent action format
 */

import { z } from 'zod';
import { DOMAnalyzer, type PageContext } from '../dom/analyzer';
import { ActionExecutor, type ActionType, type ActionParams, type ActionResult } from '../actions/executor';

// ============== Zod Schemas for Structured Output ==============

/**
 * Schema for click action
 */
export const ClickActionSchema = z.object({
  action: z.literal('click'),
  index: z.number().describe('The index of the element to click'),
  reasoning: z.string().describe('Why this action is being performed'),
});

/**
 * Schema for type/input action
 */
export const TypeActionSchema = z.object({
  action: z.literal('type'),
  index: z.number().describe('The index of the input element'),
  text: z.string().describe('The text to type into the element'),
  reasoning: z.string().describe('Why this action is being performed'),
});

/**
 * Schema for select dropdown action
 */
export const SelectActionSchema = z.object({
  action: z.literal('select'),
  index: z.number().describe('The index of the select element'),
  value: z.string().describe('The value to select'),
  reasoning: z.string().describe('Why this action is being performed'),
});

/**
 * Schema for scroll action
 */
export const ScrollActionSchema = z.object({
  action: z.literal('scroll'),
  direction: z.enum(['up', 'down']).describe('Direction to scroll'),
  reasoning: z.string().describe('Why this action is being performed'),
});

/**
 * Schema for wait action
 */
export const WaitActionSchema = z.object({
  action: z.literal('wait'),
  ms: z.number().default(1000).describe('Milliseconds to wait'),
  reasoning: z.string().describe('Why this action is being performed'),
});

/**
 * Schema for done/complete action
 */
export const DoneActionSchema = z.object({
  action: z.literal('done'),
  reasoning: z.string().describe('Why the task is considered complete'),
});

/**
 * Union schema for all possible actions - LLM must output one of these
 */
export const WebActionSchema = z.discriminatedUnion('action', [
  ClickActionSchema,
  TypeActionSchema,
  SelectActionSchema,
  ScrollActionSchema,
  WaitActionSchema,
  DoneActionSchema,
]);

/**
 * Schema for multiple actions (for form filling, etc.)
 */
export const WebActionsListSchema = z.object({
  actions: z.array(WebActionSchema).describe('List of actions to perform in order'),
  summary: z.string().describe('Brief summary of what these actions will accomplish'),
});

// Export types
export type WebAction = z.infer<typeof WebActionSchema>;
export type WebActionsList = z.infer<typeof WebActionsListSchema>;
export type ClickAction = z.infer<typeof ClickActionSchema>;
export type TypeAction = z.infer<typeof TypeActionSchema>;
export type SelectAction = z.infer<typeof SelectActionSchema>;
export type ScrollAction = z.infer<typeof ScrollActionSchema>;
export type WaitAction = z.infer<typeof WaitActionSchema>;
export type DoneAction = z.infer<typeof DoneActionSchema>;

// ============== LangChain Integration ==============

export interface LangChainConfig {
  /**
   * LangChain chat model instance 
   * Pass in ChatOpenAI, ChatAnthropic, ChatGoogleGenerativeAI, etc.
   */
  model?: unknown; // BaseChatModel from @langchain/core
  
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
 * System prompt optimized for structured output
 */
const STRUCTURED_SYSTEM_PROMPT = `You are a Web Agent AI assistant. Your job is to interact with web pages by outputting structured actions.

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

/**
 * LangChain-powered Web Agent with structured output
 */
export class LangChainWebAgent {
  private analyzer: DOMAnalyzer;
  private executor: ActionExecutor;
  private config: LangChainConfig;
  private chatModel: unknown; // Will be typed when LangChain is available
  
  constructor(config: LangChainConfig = {}) {
    this.config = {
      debug: false,
      maxRetries: 3,
      ...config,
    };
    this.analyzer = new DOMAnalyzer();
    this.executor = new ActionExecutor(this.analyzer);
    this.chatModel = config.model;
  }

  /**
   * Set the LangChain chat model
   * Use this if you want to configure the model separately
   */
  setModel(model: unknown): void {
    this.chatModel = model;
  }

  /**
   * Get current page context
   */
  getContext(): PageContext {
    const context = this.analyzer.analyze();
    this.config.onContext?.(context);
    return context;
  }

  /**
   * Get page description for LLM
   */
  getPageDescription(): string {
    return this.analyzer.getStateDescription();
  }

  /**
   * Execute a single action
   */
  async executeAction(action: WebAction): Promise<ActionResult> {
    let result: ActionResult;
    
    switch (action.action) {
      case 'click':
        result = await this.executor.execute('click', { index: action.index });
        break;
      case 'type':
        result = await this.executor.execute('type', { index: action.index, text: action.text });
        break;
      case 'select':
        result = await this.executor.execute('select', { index: action.index, value: action.value });
        break;
      case 'scroll':
        result = await this.executor.execute('scroll', { direction: action.direction });
        break;
      case 'wait':
        await new Promise(r => setTimeout(r, action.ms || 1000));
        result = { success: true, action: 'wait', message: `Waited ${action.ms || 1000}ms` };
        break;
      case 'done':
        result = { success: true, action: 'done', message: action.reasoning };
        break;
      default:
        result = { success: false, action: 'wait', message: 'Unknown action' };
    }

    this.config.onAction?.(action, result);
    this.log(`Action: ${action.action} - ${result.message}`);
    
    return result;
  }

  /**
   * Execute multiple actions in sequence
   */
  async executeActions(actions: WebAction[]): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    
    for (const action of actions) {
      const result = await this.executeAction(action);
      results.push(result);
      
      if (!result.success || action.action === 'done') {
        break;
      }
      
      // Small delay between actions
      await new Promise(r => setTimeout(r, 300));
    }
    
    return results;
  }

  /**
   * Chat with the agent using LangChain model
   * Requires @langchain/core to be installed
   */
  async chat(message: string): Promise<{ response: string; actions?: WebAction[] }> {
    const pageContext = this.getPageDescription();
    
    // If using LangChain model with structured output
    if (this.chatModel) {
      return this.chatWithLangChain(message, pageContext);
    }
    
    // Fallback to simple API call
    return this.chatWithAPI(message, pageContext);
  }

  /**
   * Execute a task automatically using LangChain
   */
  async execute(task: string, maxSteps = 10): Promise<ActionResult[]> {
    const allResults: ActionResult[] = [];
    
    for (let step = 0; step < maxSteps; step++) {
      const { actions } = await this.chat(
        step === 0 
          ? `Task: ${task}` 
          : `Continue task: ${task}\nPrevious results: ${allResults.map(r => r.message).join(', ')}`
      );
      
      if (!actions || actions.length === 0) {
        this.log('No actions returned');
        break;
      }
      
      const results = await this.executeActions(actions);
      allResults.push(...results);
      
      // Check if done
      const doneAction = actions.find(a => a.action === 'done');
      if (doneAction) {
        this.log(`Task complete: ${doneAction.reasoning}`);
        break;
      }
      
      // Wait for page updates
      await new Promise(r => setTimeout(r, 500));
    }
    
    return allResults;
  }

  /**
   * Chat using LangChain model with structured output
   */
  private async chatWithLangChain(message: string, pageContext: string): Promise<{ response: string; actions?: WebAction[] }> {
    try {
      // Dynamic import to support optional LangChain
      const model = this.chatModel as {
        withStructuredOutput?: (schema: unknown) => unknown;
        invoke?: (messages: unknown[]) => Promise<{ content: string }>;
      };
      
      // Try structured output if available
      if (model?.withStructuredOutput) {
        const structuredModel = model.withStructuredOutput(WebActionsListSchema);
        const response = await (structuredModel as { invoke: (messages: unknown[]) => Promise<WebActionsList> }).invoke([
          { role: 'system', content: STRUCTURED_SYSTEM_PROMPT },
          { role: 'user', content: `${pageContext}\n\nUser request: ${message}` },
        ]);
        
        return {
          response: response.summary,
          actions: response.actions,
        };
      }
      
      // Fallback to regular invoke and parse
      if (model?.invoke) {
        const response = await model.invoke([
          { role: 'system', content: STRUCTURED_SYSTEM_PROMPT },
          { role: 'user', content: `${pageContext}\n\nUser request: ${message}` },
        ]);
        
        const parsed = this.parseActionsFromResponse(response.content);
        return {
          response: parsed.summary || response.content,
          actions: parsed.actions,
        };
      }
    } catch (error) {
      this.log(`LangChain error: ${error}`);
    }
    
    return { response: 'LangChain model not properly configured' };
  }

  /**
   * Simple API call fallback
   */
  private async chatWithAPI(message: string, pageContext: string): Promise<{ response: string; actions?: WebAction[] }> {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      return this.mockResponse(message);
    }

    try {
      const response = await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.modelName || 'gpt-4',
          messages: [
            { role: 'system', content: STRUCTURED_SYSTEM_PROMPT },
            { role: 'user', content: `${pageContext}\n\nUser request: ${message}` },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      const parsed = this.parseActionsFromResponse(content);
      return {
        response: parsed.summary || content,
        actions: parsed.actions,
      };
    } catch (error) {
      this.log(`API error: ${error}`);
      return { response: `Error: ${error}` };
    }
  }

  /**
   * Parse actions from LLM response text
   */
  private parseActionsFromResponse(response: string): { summary?: string; actions?: WebAction[] } {
    for (let retry = 0; retry < (this.config.maxRetries || 3); retry++) {
      try {
        // Try to find JSON in response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Check if it's an actions list
        if (parsed.actions && Array.isArray(parsed.actions)) {
          const validated = WebActionsListSchema.safeParse(parsed);
          if (validated.success) {
            return validated.data;
          }
        }
        
        // Check if it's a single action
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
  private mockResponse(message: string): { response: string; actions?: WebAction[] } {
    const lower = message.toLowerCase();
    
    if (lower.includes('điền form') || lower.includes('fill form')) {
      return {
        response: 'Điền form với thông tin test',
        actions: [
          { action: 'type', index: 0, text: 'Nguyễn Văn A', reasoning: 'Điền họ tên' },
          { action: 'type', index: 1, text: 'test@example.com', reasoning: 'Điền email' },
          { action: 'type', index: 2, text: '0901234567', reasoning: 'Điền SĐT' },
          { action: 'select', index: 3, value: 'support', reasoning: 'Chọn chủ đề' },
          { action: 'type', index: 4, text: 'Tin nhắn test', reasoning: 'Điền nội dung' },
        ],
      };
    }
    
    if (lower.includes('click') || lower.includes('submit') || lower.includes('gửi')) {
      return {
        response: 'Click vào nút',
        actions: [{ action: 'click', index: 5, reasoning: 'Click submit button' }],
      };
    }
    
    return {
      response: 'Phân tích trang thành công',
      actions: [{ action: 'done', reasoning: 'Đã phân tích xong trang web' }],
    };
  }

  private log(message: string): void {
    if (this.config.debug) {
      console.log(`[LangChainWebAgent] ${message}`);
    }
    this.config.onThink?.(message);
  }
}

// ============== Factory Functions ==============

/**
 * Create agent with OpenAI model
 * Requires @langchain/openai to be installed: npm i @langchain/openai
 */
export async function createOpenAIAgent(apiKey: string, modelName = 'gpt-4'): Promise<LangChainWebAgent> {
  try {
    // @ts-ignore - Optional dependency, users need to install @langchain/openai
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({ 
      apiKey, 
      modelName,
      temperature: 0.3,
    });
    return new LangChainWebAgent({ model, debug: true });
  } catch {
    console.warn('@langchain/openai not installed, using API fallback');
    return new LangChainWebAgent({
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey,
      modelName,
      debug: true,
    });
  }
}

/**
 * Create agent with Anthropic Claude model
 * Requires @langchain/anthropic to be installed: npm i @langchain/anthropic
 */
export async function createAnthropicAgent(apiKey: string, modelName = 'claude-3-sonnet-20240229'): Promise<LangChainWebAgent> {
  try {
    // @ts-ignore - Optional dependency, users need to install @langchain/anthropic
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const model = new ChatAnthropic({ 
      apiKey, 
      modelName,
      temperature: 0.3,
    });
    return new LangChainWebAgent({ model, debug: true });
  } catch {
    console.warn('@langchain/anthropic not installed');
    return new LangChainWebAgent({ debug: true });
  }
}

/**
 * Create agent with Google Gemini model
 * Requires @langchain/google-genai to be installed: npm i @langchain/google-genai
 */
export async function createGeminiAgent(apiKey: string, modelName = 'gemini-pro'): Promise<LangChainWebAgent> {
  try {
    // @ts-ignore - Optional dependency, users need to install @langchain/google-genai
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    const model = new ChatGoogleGenerativeAI({ 
      apiKey, 
      modelName,
      temperature: 0.3,
    });
    return new LangChainWebAgent({ model, debug: true });
  } catch {
    console.warn('@langchain/google-genai not installed');
    return new LangChainWebAgent({ debug: true });
  }
}

/**
 * Create agent with custom OpenAI-compatible API (like MISA AI)
 */
export function createCustomAgent(config: {
  apiEndpoint: string;
  apiKey: string;
  modelName?: string;
}): LangChainWebAgent {
  return new LangChainWebAgent({
    apiEndpoint: config.apiEndpoint,
    apiKey: config.apiKey,
    modelName: config.modelName,
    debug: true,
  });
}
