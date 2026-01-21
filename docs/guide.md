# Web Agent SDK Documentation

## Introduction
web-agent-sdk is a powerful library for building AI-powered browser agents. It integrates with LangChain to support various LLMs (Gemini, OpenAI, Claude) and provides intelligent DOM analysis and action execution capabilities.

## Installation

```bash
npm install web-agent-sdk
```

## Basic Usage

### 1. Using with Google Gemini

```typescript
import { createGeminiAgent } from 'web-agent-sdk';

async function main() {
  // Create an agent using Gemini 1.5 Flash
  const agent = await createGeminiAgent('YOUR_API_KEY', 'gemini-1.5-flash');
  
  // Execute a task
  await agent.execute('Fill the flight booking form with random data');
}
```

### 2. Using with OpenAI

```typescript
import { createOpenAIAgent } from 'web-agent-sdk';

async function main() {
  // Create an agent using GPT-4
  const agent = await createOpenAIAgent('YOUR_API_KEY', 'gpt-4');
  
  // Execute a task
  await agent.execute('Click the login button and enter credentials');
}
```

### 3. Using Custom OpenAI-compatible Provider (e.g. Ollama, vLLM)

```typescript
import { createCustomAgent } from 'web-agent-sdk';

async function main() {
  const agent = await createCustomAgent({
    apiKey: 'ollama', // or your key
    baseURL: 'http://localhost:11434/v1', // Custom endpoint
    modelName: 'llama3',
  });
  
  await agent.execute('Task...');
}
```
*Note: Ensure `@langchain/openai` is installed to enable full Planner capabilities with custom providers.*

## Advanced Features

### Planner-Actor Architecture
The SDK automatically uses a Planner-Actor architecture.
- **Planner**: Analyzes the page state and creates a high-level plan. It explicitly verifies if the task is complete before proceeding.
- **Actor**: Executes the specific actions (click, type, select) required by the plan.

This architecture prevents the agent from getting stuck in loops or repeating actions unnecessarily, as the Planner "sees" the results of previous actions.

### Custom Skills
You can provide custom instructions or "skills" to the agent to guide its behavior. This is useful for domain-specific tasks or enforcing business rules.

```typescript
import { LangChainWebAgent } from 'web-agent-sdk';
// Assume model is initialized

const agent = new LangChainWebAgent({
  model: model,
  skills: `
    - Always select "Express Shipping" if available.
    - Never click the "Delete" button.
    - If the page asks for a phone number, use 555-0123.
    - When filling dates, always use format YYYY-MM-DD.
  `
});
```

These instructions are injected into both the Planner and Executor prompts.

### Handling Errors (Fallback)
The SDK includes a robust fallback mechanism. If the structured output (function calling) fails - which can happen with some newer models or specific API versions (like Gemini 3 Preview) - the agent automatically switches to Prompt Engineering mode to continue the task without interruption.

### Batch Actions
The agent supports performing multiple actions in a single step. For example, it can fill out an entire form (Name, Email, Phone, Address) in one go, significantly improving speed and efficiency compared to step-by-step execution.

## Configuration Options

```typescript
interface LangChainConfig {
  // The LangChain chat model instance
  model?: BaseChatModel;
  
  // API endpoint for generic usage without LangChain object
  apiEndpoint?: string;
  apiKey?: string;
  
  // Enable debug logs in console
  debug?: boolean;
  
  // Custom instructions/skills
  skills?: string;
  
  // Force disable structured output (useful for Gemini to avoid 400 errors)
  // Default: true (enabled)
  useStructuredOutput?: boolean;
}
```
