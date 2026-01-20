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

// Core exports
export { WebAgent, type WebAgentConfig, type ChatMessage, type AgentAction } from './agent/web-agent';

// DOM Analysis
export { DOMAnalyzer, type PageContext, type InteractiveElement, type FormInfo, type TableInfo, type LinkInfo, type HeadingInfo } from './dom/analyzer';

// Actions
export { ActionExecutor, type ActionType, type ActionParams, type ActionResult } from './actions/executor';

// LangChain Agent with Structured Output
export {
  LangChainWebAgent,
  type LangChainConfig,
  type WebAction,
  type WebActionsList,
  // Zod Schemas for validation
  WebActionSchema,
  WebActionsListSchema,
  ClickActionSchema,
  TypeActionSchema,
  SelectActionSchema,
  ScrollActionSchema,
  WaitActionSchema,
  DoneActionSchema,
  // Factory functions
  createOpenAIAgent,
  createAnthropicAgent,
  createGeminiAgent,
  createCustomAgent,
} from './agent/langchain-agent';

// Re-export WebAgent as default
import { WebAgent } from './agent/web-agent';
export default WebAgent;
