# Web Agent SDK Documentation

## 1. Overview
`web-agent-sdk` is a professional-grade framework for building AI-powered browser agents. Unlike traditional automation tools (Selenium, Playwright) that rely on brittle selectors, this SDK uses **LLM-based reasoning** to understand and interact with any webpage dynamically.

It features a **Planner-Actor Architecture**:
- **Planner**: Analyzes the page state and user goal to create a high-level plan.
- **Actor (Executor)**: Translates the plan into precise DOM actions (click, type, scroll).

## 2. Core Features

### 🧠 Universal DOM Analyzer
The SDK includes a sophisticated `DOMAnalyzer` that "sees" the page like a human user:
- **Interactive Element Detection**: Automatically identifies clickable elements (`<a>`, `<button>`, inputs) and semantic roles (`role="button"`, `tabindex="0"`).
- **Visibility Checks**: Ignores hidden elements (opacity: 0, display: none, off-screen).
- **Form Analysis**: Associates labels with inputs, detects required fields.
- **Error Detection**: Reads HTML5 validation errors, `aria-invalid` states, and `role="alert"` messages (to fix mistakes automatically).

### 🤖 Multi-Model Support
Built on top of LangChain, supporting top-tier LLMs:
- **Google Gemini**: Optimized for speed and long context.
- **OpenAI GPT-4**: High reasoning capability for complex tasks.
- **Anthropic Claude**: Excellent for instruction following.
- **Custom Models**: Connect to any OpenAI-compatible API (e.g., local LLMs, proxies).

### 🛡️ Reliability Features
- **Structured Output**: Enforces valid JSON actions using Zod schemas (preventing hallucinations).
- **Loop Detection**: Automatically detects and breaks repetitive action loops.
- **Auto-Correction**: If an action fails (e.g., element covered), the agent retries or replans.

### 💾 State Management
- **Persistence**: Export and import agent state to survive page reloads.
- **Context Awareness**: Tracks conversation history and past actions.

## 3. Installation

```bash
npm install web-agent-sdk
# Peer dependencies
npm install @langchain/core
```

## 4. API Reference

### Factory Functions

#### `createGeminiAgent(apiKey, modelName, config)`
Creates an agent using Google's Gemini models.
```typescript
const agent = await createGeminiAgent(process.env.GEMINI_API_KEY, 'gemini-pro');
```

#### `createOpenAIAgent(apiKey, modelName, config)`
Creates an agent using OpenAI's GPT models.
```typescript
const agent = await createOpenAIAgent(process.env.OPENAI_API_KEY, 'gpt-4o');
```

#### `createCustomAgent(config, options)`
Connect to a custom endpoint (useful for Backend Proxy).
```typescript
const agent = await createCustomAgent({
  apiKey: 'unused', // If handled by proxy
  baseURL: 'http://localhost:3000/api/chat' // Your backend proxy
});
```

### LangChainWebAgent Class

#### `execute(task: string, maxSteps?: number, resume?: boolean)`
Main entry point. Executes a goal on the current page.
- `task`: The user's instruction.
- `maxSteps`: Safety limit (default 10).
- `resume`: If `true`, continues from previous history. If `false` (default), starts fresh.

#### `setSkills(skills: string)`
Updates the agent's system prompt with specific instructions. Useful for routing.
```typescript
agent.setSkills("You are on the Checkout page. Use mock data only.");
```

#### `exportState()` / `importState(json)`
Serialize/Deserialize the agent's memory (history, results). Essential for handling page navigation.

#### Configuration (`LangChainConfig`)
- `debug`: Enable console logs for internal thoughts.
- `skills`: Initial system instructions.
- `onThink`: Callback when the Planner generates a thought.
- `onAction`: Callback when an action is executed.
- `onActionStart`: Callback before an action (good for saving state).

## 5. Integration Patterns & Best Practices

### 🔒 Security: Backend Proxy Pattern
**NEVER** expose API keys in the frontend. Use a proxy pattern:

1.  **Frontend**: The SDK runs in the browser to access the DOM. Configure it to point to your backend.
    ```typescript
    // Proxy Class in Frontend
    class BackendProxyModel {
      async invoke(messages) {
        const res = await fetch('/api/chat', { method: 'POST', body: JSON.stringify({ messages }) });
        return await res.json();
      }
    }
    const agent = new LangChainWebAgent({ model: new BackendProxyModel() });
    ```
2.  **Backend**: Receives the prompt, adds the API Key, and calls the LLM.

### 🔄 Handling Page Navigation (Auto-Resume)
Browsers destroy JS context on navigation. To create a continuous experience:

1.  **Save State**: On every action, save `agent.exportState()` and the current `task` to `localStorage`.
2.  **Restore on Load**: When the new page loads, check `localStorage`.
3.  **Resume**: If a task was in progress (history exists but no "Completion" event), call `agent.execute(task, ..., true)`.

```typescript
// Example Logic
const savedState = localStorage.getItem('agent-state');
if (savedState) {
  agent.importState(savedState);
  // Check if last entry was NOT completion
  if (!isTaskComplete(savedState)) {
     agent.execute(savedTask, 10, true); // Resume!
  }
}
```

### 🧠 Context-Aware Prompts
The Planner only sees the *current* task string. It doesn't know about previous chat turns.
**Fix**: When sending a task, prepend the chat history.
```typescript
const taskWithContext = `
HISTORY:
User: Add keyboard
Agent: Added.
User: Checkout (Current Request)
`;
agent.execute(taskWithContext);
```

### 🎨 UI Implementation (Copilot Style)
- **Hide Complexity**: Use `onThink` to capture "Plan" and "Questions", but hide the raw logs.
- **Progress Bar**: Show a loading indicator while the agent works.
- **Interactive Feedback**: If the agent outputs `ASK: ...`, display this as a message to the user.

## 6. Troubleshooting

### "Agent can't click the button"
**Cause**: The element uses a `<div>` or `<span>` with a click handler but no semantic role. The `DOMAnalyzer` ignores non-interactive elements to reduce noise.
**Fix**: Add `role="button"` and `tabindex="0"` to the element in your HTML/Vue/React code.

### "Agent loops saying 'Task Completed'"
**Cause**: You are calling `execute(..., true)` (resume) after the task was already finished. The agent sees "Completion" in history and stops immediately.
**Fix**: Only use `resume=true` if the previous task was *interrupted* (e.g., by navigation). For a new user request, start fresh (`resume=false`).
