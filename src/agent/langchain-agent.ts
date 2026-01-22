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
   * Callback when action starts (useful for state saving before navigation)
   */
  onActionStart?: (action: WebAction) => void;
  
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

  /**
   * Whether to use native structured output (if available).
   * Set to false to force prompt engineering (useful for models with partial schema support like Gemini).
   * @default true
   */
  useStructuredOutput?: boolean;

  /**
   * Custom instructions or skills to guide the agent
   */
  skills?: string;

  /**
   * Max tokens for LLM response
   */
  maxTokens?: number;
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
- Pay attention to ERRORS & WARNINGS in the page state. If validation errors are present, fix them before proceeding.
- Output valid JSON only - no markdown, no explanation text outside JSON`;

/**
 * LangChain-powered Web Agent with structured output
 */
export class LangChainWebAgent {
  private analyzer: DOMAnalyzer;
  private executor: ActionExecutor;
  private config: LangChainConfig;
  private chatModel: unknown; // Will be typed when LangChain is available
  private history: string[] = [];
  private results: ActionResult[] = [];
  private lastAction: WebAction | null = null;
  
  constructor(config: LangChainConfig = {}) {
    this.config = {
      debug: false,
      maxRetries: 3,
      useStructuredOutput: true,
      ...config,
    };
    this.analyzer = new DOMAnalyzer();
    this.executor = new ActionExecutor(this.analyzer);
    this.chatModel = config.model;
  }

  /**
   * Export current agent state
   */
  exportState(): string {
    return JSON.stringify({
      history: this.history,
      results: this.results
    });
  }

  /**
   * Import agent state
   */
  importState(stateJson: string): void {
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
    // General Loop Detection
    if (this.lastAction && action.action !== 'scroll' && action.action !== 'wait') {
       const cleanA = { ...action, reasoning: '' };
       const cleanB = { ...this.lastAction, reasoning: '' };
       if (JSON.stringify(cleanA) === JSON.stringify(cleanB)) {
           const loopMsg = `Loop detected: You just performed this exact action (${action.action}). Try something else.`;
           this.log(loopMsg);
           return { success: false, action: action.action as any, message: loopMsg };
       }
    }
    this.lastAction = action;

    // Optimistic history update
    this.history.push(`Action: ${action.action} (executing)`);
    this.config.onActionStart?.(action);

    let result: ActionResult;
    
    try {
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
    } catch (e) {
      result = { success: false, action: action.action as any, message: `Failed: ${e}` };
    }

    // Update history with final result
    this.history[this.history.length - 1] = `Action: ${action.action} (${result.message})`;
    this.results.push(result);

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
   * Execute a task automatically using Planner-Actor architecture
   */
  async execute(task: string, maxSteps = 10, resume = false): Promise<ActionResult[]> {
    if (!resume) {
      this.results = [];
      this.history = [];
    }
    
    // Continue from previous step count
    const startStep = this.results.length > 0 ? Math.floor(this.history.length / 2) : 0;
    
    for (let step = startStep; step < maxSteps; step++) {
      const pageContext = this.getPageDescription();
      
      this.log(`Planning step ${step + 1}`);
      
      // Add urgency if running out of steps
      let urgencyInstruction = "";
      if (maxSteps - step <= 3) {
        urgencyInstruction = `\n\nCRITICAL WARNING: You have ${maxSteps - step} steps remaining. You MUST conclude the task immediately. If you cannot finish, output "DONE: <summary of what was achieved and what failed>". Do NOT start new exploration actions.`;
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

${this.config.skills ? `ADDITIONAL SKILLS/INSTRUCTIONS:\n${this.config.skills}` : ''}`;

        const plannerUserContent = `PAGE STATE:
${pageContext}

ACTION HISTORY:
${this.history.join('\n')}

What is the next step?`;

        let plan = '';

        if (this.chatModel) {
          // Planner Step via LangChain
          // @ts-ignore - Dynamic type for LangChain model
          const planResponse = await this.chatModel.invoke([
            ['system', plannerSystemPrompt],
            ['human', plannerUserContent]
          ]);
          // @ts-ignore
          plan = planResponse.content.toString().trim();
        } else {
          // Planner Step via Custom API
          plan = await this.callAPI([
            { role: 'system', content: plannerSystemPrompt },
            { role: 'user', content: plannerUserContent }
          ], false); // No JSON mode for Planner (text)
        }
        
        this.log(`Plan: ${plan}`);
        
        if (plan.startsWith('ASK:')) {
          this.log(`Agent Question: ${plan.substring(4).trim()}`);
          // Stop execution to let user respond
          break;
        }

        if (plan.toUpperCase().startsWith('DONE') || plan.includes('successfully booked')) {
          this.log('Task verified as complete');
          // Save completion to history so it persists across reloads/sessions
          this.history.push(`Completion: ${plan}`);
          if (plan.length > 4) {
             this.log(plan.substring(5).trim());
          }
          break;
        }

        // Execution Step
        // Pass original task context so Executor knows about constraints (e.g. "Do not submit")
        const { actions, response } = await this.chat(`Original Task Context: ${task}\n\nExecute this step: ${plan}`);
        
        if (actions && actions.length > 0) {
          await this.executeActions(actions);
          // History is updated inside executeAction now
        } else {
          this.history.push(`Observation: ${response}`);
        }
        
        // Wait for page updates
        await new Promise(r => setTimeout(r, 1000));

      } catch (error) {
        this.log(`Planning error: ${error}`);
        // If critical error in planning, maybe try simple execution for remaining steps if it was a model issue?
        // But if API is down, simple execution won't work either.
        // We will just break loop or return what we have.
        break; 
      }
    }
    
    return this.results;
  }

  /**
   * Simple ReAct execution loop (Legacy/Fallback)
   */
  private async executeSimple(task: string, maxSteps = 10): Promise<ActionResult[]> {
    const allResults: ActionResult[] = [];
    const history: string[] = [];
    
    for (let step = 0; step < maxSteps; step++) {
      const pageContext = this.getPageDescription();
      
      this.log(`Planning step ${step + 1}`);
      
      try {
        // Planner Step
        // @ts-ignore - Dynamic type for LangChain model
        const planResponse = await this.chatModel.invoke([
          ['system', `You are a Browser Agent Planner.
Your goal is to complete the user's task on the current page.
1. Analyze the PAGE STATE and ACTION HISTORY.
2. VERIFY if the task is already completed based on the state (e.g. success message visible, data updated).
3. If COMPLETED, output exactly: "DONE"
4. If NOT COMPLETED, provide the NEXT STEP. 
   - Group related actions together (e.g. "Fill all form fields", "Enter details and click submit").
   - Do not break down into single clicks unless necessary.

Task: ${task}

${this.config.skills ? `ADDITIONAL SKILLS/INSTRUCTIONS:\n${this.config.skills}` : ''}`],
          ['human', `PAGE STATE:
${pageContext}

ACTION HISTORY:
${history.join('\n')}

What is the next step?`]
        ]);
        
        // @ts-ignore
        const plan = planResponse.content.toString().trim();
        this.log(`Plan: ${plan}`);
        
        if (plan.toUpperCase().startsWith('DONE') || plan.includes('successfully booked')) {
          this.log('Task verified as complete');
          break;
        }

        // Execution Step
        // Pass original task context so Executor knows about constraints (e.g. "Do not submit")
        const { actions, response } = await this.chat(`Original Task Context: ${task}\n\nExecute this step: ${plan}`);
        
        if (actions && actions.length > 0) {
          const results = await this.executeActions(actions);
          allResults.push(...results);
          results.forEach(r => history.push(`Action: ${r.action} (${r.message})`));
        } else {
          history.push(`Observation: ${response}`);
        }
        
        // Wait for page updates
        await new Promise(r => setTimeout(r, 1000));

      } catch (error) {
        this.log(`Planning error: ${error}`);
        // Fallback to simple execution for this step if planning fails
        return this.executeSimple(task, maxSteps - step);
      }
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
      
      // Try structured output if available and enabled
      if (this.config.useStructuredOutput && model?.withStructuredOutput) {
        try {
          const structuredModel = model.withStructuredOutput(WebActionsListSchema);
          const response = await (structuredModel as { invoke: (messages: unknown[]) => Promise<WebActionsList> }).invoke([
            ['system', `${STRUCTURED_SYSTEM_PROMPT}\n\n${this.config.skills ? `ADDITIONAL SKILLS:\n${this.config.skills}` : ''}`],
            ['human', `${pageContext}\n\nUser request: ${message}`],
          ]);
          
          return {
            response: response.summary,
            actions: response.actions,
          };
        } catch (e) {
          this.log(`Structured output failed, falling back to prompt engineering: ${e}`);
          // Fall through to regular invoke
        }
      }
      
      // Fallback to regular invoke and parse
      if (model?.invoke) {
        const response = await model.invoke([
          ['system', `${STRUCTURED_SYSTEM_PROMPT}\n\n${this.config.skills ? `ADDITIONAL SKILLS:\n${this.config.skills}` : ''}`],
          ['human', `${pageContext}\n\nUser request: ${message}`],
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
   * Helper to call API endpoint
   */
  private async callAPI(messages: any[], jsonMode = false): Promise<string> {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      throw new Error('API config missing');
    }

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.modelName || 'gpt-4',
        messages,
        temperature: 0.3,
        max_tokens: this.config.maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * Simple API call fallback
   */
  private async chatWithAPI(message: string, pageContext: string): Promise<{ response: string; actions?: WebAction[] }> {
    if (!this.config.apiEndpoint || !this.config.apiKey) {
      return this.mockResponse(message);
    }

    try {
      const content = await this.callAPI([
        { role: 'system', content: `${STRUCTURED_SYSTEM_PROMPT}\n\n${this.config.skills ? `ADDITIONAL SKILLS:\n${this.config.skills}` : ''}` },
        { role: 'user', content: `${pageContext}\n\nUser request: ${message}` },
      ], true); // Use JSON mode for Executor
      
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
export async function createOpenAIAgent(
  apiKey: string, 
  modelName = 'gpt-4',
  options: Partial<LangChainConfig> = {}
): Promise<LangChainWebAgent> {
  try {
    // @ts-ignore - Optional dependency, users need to install @langchain/openai
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({ 
      apiKey, 
      modelName,
      temperature: 0.3,
      maxTokens: options.maxTokens,
    });
    return new LangChainWebAgent({ model, debug: true, ...options });
  } catch {
    console.warn('@langchain/openai not installed, using API fallback');
    return new LangChainWebAgent({
      apiEndpoint: 'https://api.openai.com/v1/chat/completions',
      apiKey,
      modelName,
      debug: true,
      ...options
    });
  }
}

/**
 * Create agent with Anthropic Claude model
 * Requires @langchain/anthropic to be installed: npm i @langchain/anthropic
 */
export async function createAnthropicAgent(
  apiKey: string, 
  modelName = 'claude-3-sonnet-20240229',
  options: Partial<LangChainConfig> = {}
): Promise<LangChainWebAgent> {
  try {
    // @ts-ignore - Optional dependency, users need to install @langchain/anthropic
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const model = new ChatAnthropic({ 
      apiKey, 
      modelName,
      temperature: 0.3,
      maxTokens: options.maxTokens,
    });
    return new LangChainWebAgent({ model, debug: true, ...options });
  } catch {
    console.warn('@langchain/anthropic not installed');
    return new LangChainWebAgent({ debug: true, ...options });
  }
}

/**
 * Create agent with Google Gemini model
 * Requires @langchain/google-genai to be installed: npm i @langchain/google-genai
 */
export async function createGeminiAgent(
  apiKey: string, 
  modelName = 'gemini-pro', 
  options: Partial<LangChainConfig> = {}
): Promise<LangChainWebAgent> {
  try {
    // @ts-ignore - Optional dependency, users need to install @langchain/google-genai
    const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai');
    const model = new ChatGoogleGenerativeAI({ 
      apiKey, 
      modelName,
      temperature: 0.3,
      maxOutputTokens: options.maxTokens,
    });
    // Disable structured output for Gemini by default due to schema compatibility issues (const keyword)
    return new LangChainWebAgent({ model, debug: true, useStructuredOutput: false, ...options });
  } catch {
    console.warn('@langchain/google-genai not installed');
    return new LangChainWebAgent({ debug: true, ...options });
  }
}

/**
 * Create agent with custom OpenAI-compatible API (like MISA AI, Ollama, vLLM)
 * Tries to use ChatOpenAI if available to enable Planner capabilities.
 */
export async function createCustomAgent(
  config: {
    apiKey: string;
    baseURL?: string;
    apiEndpoint?: string; // Legacy alias for baseURL
    modelName?: string;
  },
  options: Partial<LangChainConfig> = {}
): Promise<LangChainWebAgent> {
  const baseUrl = config.baseURL || config.apiEndpoint;

  try {
    // @ts-ignore - Optional dependency
    const { ChatOpenAI } = await import('@langchain/openai');
    const model = new ChatOpenAI({
      apiKey: config.apiKey,
      modelName: config.modelName,
      configuration: {
        baseURL: baseUrl,
      },
      temperature: 0,
      maxTokens: options.maxTokens,
    });
    return new LangChainWebAgent({ model, debug: true, ...options });
  } catch {
    console.warn('@langchain/openai not installed, using API fallback (No Planner support)');
    return new LangChainWebAgent({
      apiEndpoint: baseUrl,
      apiKey: config.apiKey,
      modelName: config.modelName,
      debug: true,
      ...options
    });
  }
}
