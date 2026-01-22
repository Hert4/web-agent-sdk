# Web Agent SDK Documentation

## Introduction
`web-agent-sdk` is a professional-grade library for building AI-powered browser agents. It leverages LangChain to support state-of-the-art LLMs (Google Gemini, OpenAI, Anthropic Claude) and provides a robust Planner-Actor architecture for reliable web automation.

## Installation

```bash
npm install web-agent-sdk
# Peer dependencies
npm install @langchain/core
```

## Quick Start

### 1. Using with Google Gemini

```typescript
import { createGeminiAgent } from 'web-agent-sdk';

const agent = await createGeminiAgent(process.env.GEMINI_API_KEY, 'gemini-3-flash-preview');
await agent.execute('Find the cheapest keyboard on amazon.com');
```

### 2. Using with OpenAI

```typescript
import { createOpenAIAgent } from 'web-agent-sdk';

const agent = await createOpenAIAgent(process.env.OPENAI_API_KEY, 'gpt-4o');
await agent.execute('Login to the dashboard');
```

## Interactive Elements & DOM Analysis

The SDK uses an intelligent DOM Analyzer to identifying "interactive" elements on a page. The Agent can **only** interact with elements that are detected as interactive.

### Supported Elements
The Agent automatically detects elements matching these criteria:
*   **Links**: `<a>` tags with an `href` attribute.
*   **Buttons**: `<button>` tags, `input[type="submit"]`, `input[type="button"]`.
*   **Inputs**: All `<input>` types (text, checkbox, radio, etc.), `<textarea>`, `<select>`.
*   **Semantic Roles**: Elements with `role="button"`, `role="link"`, `role="checkbox"`, etc.
*   **Focusable Elements**: Elements with a valid `tabindex` (not `-1`).
*   **Clickable Elements**: Elements with an inline `onclick` attribute.

### Best Practices for Compatibility
If your website uses non-standard elements (e.g., a `<div>` or `<p>` acting as a button), the Agent might **not see it**. To ensure compatibility:

1.  **Use Semantic HTML**: Prefer `<button>` over `<div>` for clickable actions.
2.  **Add Accessibility Attributes**: If you must use a generic tag, add `role="button"` and `tabindex="0"`.
    ```html
    <!-- BAD: Agent ignores this -->
    <div onclick="submit()">Submit</div>

    <!-- GOOD: Agent sees this -->
    <div role="button" tabindex="0" onclick="submit()">Submit</div>
    ```
3.  **Ensure Visibility**: The Agent ignores hidden elements (`display: none`, `visibility: hidden`, `opacity: 0`, or zero dimensions).

## Configuration & Callbacks

You can customize the agent's behavior and hook into its lifecycle using the configuration object.

```typescript
import { createGeminiAgent } from 'web-agent-sdk';

const agent = await createGeminiAgent('API_KEY', 'model-name', {
  // Debug mode: logs internal thoughts and actions to console
  debug: true,

  // Custom Skills: Guide the agent's behavior
  skills: `
    - Never making any finally submit if do not have user permission.
    - Do not make up any information, if user not clearly make sure you ask user before fill any information.
  `,

  // Lifecycle Callbacks
  
  // Called when the agent "thinks" or plans (e.g. "I need to click the search bar")
  onThink: (thought: string) => {
    console.log('Thinking:', thought);
  },

  // Called IMMEDIATELY when an action is about to start
  // Use this to save state before navigation happens!
  onActionStart: (action: WebAction) => {
    console.log('Starting:', action.action);
    saveStateToLocalStorage(); 
  },

  // Called when an action completes (success or failure)
  onAction: (action: WebAction, result: ActionResult) => {
    console.log('Finished:', action.action, 'Success:', result.success);
  },
  
  // Called when the page context is analyzed
  onContext: (context: PageContext) => {
    console.log('Page Title:', context.title);
  }
});
```

## State Management & Persistence

The SDK supports saving and restoring state, which is crucial for handling page reloads or long-running sessions.

### Saving State
```typescript
// Get a JSON string representing the full history
const stateJson = agent.exportState();
localStorage.setItem('agent-state', stateJson);
```

### Resuming State
```typescript
const savedState = localStorage.getItem('agent-state');
if (savedState) {
  agent.importState(savedState);
  // Pass 'true' as the 3rd argument to execute to indicate resumption
  await agent.execute('Continue task...', 15, true);
}
```

### Handling Navigation (Page Reloads)
Since a page reload destroys the JavaScript context, you must save state **before** the reload happens. 
*   Use `onActionStart` to save state *optimistically* before every action.
*   Use `window.addEventListener('beforeunload', ...)` as a backup.

## Troubleshooting

### Agent loops or repeats the same action
*   **Cause**: The agent lost its history after a page reload, or the action failed silently.
*   **Fix**: Ensure you are saving/restoring state correctly. The SDK has built-in loop detection that blocks identical consecutive actions (like clicking the same button twice).

### Agent can't find a button
*   **Cause**: The element is not semantic (e.g., a `span` with a click listener).
*   **Fix**: Update your HTML to include `role="button"` or use a `<button>` tag.

### Agent stops early
*   **Cause**: Step limit reached (default 15).
*   **Fix**: The Agent will now warn the Planner when steps are running low (3 steps left) to force a conclusion. You can increase `maxSteps` in `agent.execute(task, maxSteps)`.
