# web-agent-sdk

**Universal Web Agent SDK** - AI-powered browser automation that works on any webpage without configuration.

Like LangChain but for web browser automation - just import and use on any website.

## Features

- 🌐 **Universal**: Works on any webpage automatically
- 🤖 **AI-Powered**: Integrates with OpenAI, Claude, Gemini
- 📖 **Auto Context**: Reads and understands page structure
- 🎯 **Smart Actions**: Click, type, scroll, navigate
- 🔌 **Zero Config**: No teaching or configuration needed
- 📦 **Lightweight**: Works in browser, no server needed

## Installation

```bash
npm install web-agent-sdk
# or
pnpm add web-agent-sdk
```

## Quick Start

```typescript
import { WebAgent } from 'web-agent-sdk';

// Create agent with LLM API
const agent = new WebAgent({
  apiKey: 'your-openai-key',
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4',
  debug: true
});

// Chat with the agent about the current page
const response = await agent.chat('What buttons are on this page?');
console.log(response);

// Execute a task automatically
await agent.execute('Fill the login form with test@example.com');
```

## Core Concepts

### 1. Page Analysis (Auto Context)

The SDK automatically analyzes any webpage and extracts:
- Interactive elements (buttons, links, inputs)
- Forms and their fields
- Page structure (headings, sections)
- Text content

```typescript
import { DOMAnalyzer } from 'web-agent-sdk';

const analyzer = new DOMAnalyzer();
const context = analyzer.analyze();

console.log(context.elements); // All interactive elements
console.log(context.forms);    // Forms on page
console.log(context.links);    // All links
```

### 2. Actions

Perform any action on the page:

```typescript
import { WebAgent } from 'web-agent-sdk';

const agent = new WebAgent();

// Click element by index
await agent.act('click', { index: 5 });

// Type text
await agent.act('type', { index: 3, text: 'Hello World' });

// Scroll
await agent.act('scroll', { direction: 'down' });

// Navigate
await agent.act('navigate', { url: 'https://example.com' });
```

### 3. AI Agent

Let AI decide what actions to take:

```typescript
const agent = new WebAgent({
  apiKey: process.env.OPENAI_API_KEY,
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  onAction: (action, params, result) => {
    console.log(`Action: ${action}`, result);
  }
});

// Agent will analyze page and perform actions
const results = await agent.execute('Search for "web automation" and click first result');
```

## Usage in Web Projects

### React

```tsx
import { useEffect, useState } from 'react';
import { WebAgent, PageContext } from 'web-agent-sdk';

function AgentPanel() {
  const [agent] = useState(() => new WebAgent({ debug: true }));
  const [context, setContext] = useState<PageContext | null>(null);

  useEffect(() => {
    setContext(agent.getContext());
  }, []);

  const handleTask = async (task: string) => {
    await agent.execute(task);
    setContext(agent.getContext()); // Refresh context
  };

  return (
    <div>
      <h2>Page Elements: {context?.elements.length}</h2>
      <button onClick={() => handleTask('Click the submit button')}>
        Auto Submit
      </button>
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { WebAgent, type PageContext } from 'web-agent-sdk';

const agent = new WebAgent({ debug: true });
const context = ref<PageContext | null>(null);

onMounted(() => {
  context.value = agent.getContext();
});

async function executeTask(task: string) {
  await agent.execute(task);
  context.value = agent.getContext();
}
</script>

<template>
  <div>
    <h2>Elements: {{ context?.elements.length }}</h2>
    <button @click="executeTask('Fill the form')">Auto Fill</button>
  </div>
</template>
```

### Vanilla JavaScript

```html
<script type="module">
import { WebAgent } from 'web-agent-sdk';

const agent = new WebAgent({
  apiKey: 'your-key',
  apiEndpoint: 'https://api.openai.com/v1/chat/completions'
});

// Get page context
const context = agent.getContext();
console.log('Found', context.elements.length, 'interactive elements');

// Execute task
document.getElementById('automate-btn').onclick = async () => {
  await agent.execute('Click the first link on the page');
};
</script>
```

## API Reference

### WebAgent

```typescript
interface WebAgentConfig {
  apiEndpoint?: string;  // LLM API endpoint
  apiKey?: string;       // API key
  model?: string;        // Model name (default: 'gpt-4')
  systemPrompt?: string; // Custom prompt
  debug?: boolean;       // Enable logging
  onAction?: (action, params, result) => void;
  onThink?: (thought: string) => void;
  onContext?: (context: PageContext) => void;
}

class WebAgent {
  constructor(config?: WebAgentConfig);
  
  // Chat with agent
  chat(message: string): Promise<string>;
  
  // Execute task automatically
  execute(task: string, maxSteps?: number): Promise<ActionResult[]>;
  
  // Perform single action
  act<T extends ActionType>(action: T, params: ActionParams[T]): Promise<ActionResult>;
  
  // Get page context
  getContext(): PageContext;
  
  // Get readable page description
  getPageDescription(): string;
  
  // Stop execution
  stop(): void;
}
```

### DOMAnalyzer

```typescript
class DOMAnalyzer {
  analyze(): PageContext;
  getElement(index: number): Element | null;
  getStateDescription(): string;
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
```

### ActionExecutor

```typescript
type ActionType = 'click' | 'type' | 'clear' | 'select' | 'scroll' | 
                  'hover' | 'focus' | 'wait' | 'navigate' | 
                  'goBack' | 'goForward' | 'refresh';

class ActionExecutor {
  execute<T extends ActionType>(action: T, params: ActionParams[T]): Promise<ActionResult>;
}
```

## License

MIT
