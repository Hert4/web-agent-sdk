import { createCustomAgent } from 'web-agent-sdk';

// Render UI
const overlay = document.getElementById('agent-overlay');
if (!overlay) throw new Error('Overlay not found');

const shadow = overlay.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    .panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 350px;
      background: white;
      border: 1px solid #ccc;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
      padding: 15px;
      border-radius: 8px;
      z-index: 10000;
      font-family: system-ui;
    }
    .input-group { margin-bottom: 10px; }
    label { display: block; font-size: 12px; margin-bottom: 2px; }
    input, textarea { width: 100%; box-sizing: border-box; padding: 5px; border: 1px solid #ddd; border-radius: 4px; }
    button { width: 100%; padding: 8px; background: #007bff; color: white; border: none; cursor: pointer; border-radius: 4px; }
    button:disabled { background: #ccc; }
    #logs {
      height: 200px;
      overflow-y: auto;
      background: #f5f5f5;
      border: 1px solid #ddd;
      margin-top: 10px;
      padding: 5px;
      font-size: 12px;
      white-space: pre-wrap;
    }
    h3 { margin-top: 0; }
  </style>
  <div class="panel">
    <h3>OpenAI Browser Agent</h3>
    <div class="input-group">
      <label>API Key</label>
      <input type="password" id="api-key" placeholder="sk-...">
    </div>
    <div class="input-group">
      <label>Base URL (Optional)</label>
      <input type="text" id="base-url" placeholder="https://api.openai.com/v1">
    </div>
    <div class="input-group">
      <label>Model Name</label>
      <input type="text" id="model-name" value="gpt-4">
    </div>
    <div class="input-group">
      <label>Task</label>
      <textarea id="task" rows="5" placeholder="What should I do?">Fill flight details: From Hanoi to Da Nang, Date 2024-05-20, Class Business.
Then add passengers: Nguyen Van A (Pass123, Age 30) and Le Thi B (Pass456, Age 28).
Finally enter payment: Card 4242424242424242, Exp 12/25, CVC 123.</textarea>
    </div>
    <button id="run-btn">Run Agent</button>
    <div id="logs"></div>
  </div>
`;

// Logic
const apiKeyInput = shadow.getElementById('api-key') as HTMLInputElement;
const baseUrlInput = shadow.getElementById('base-url') as HTMLInputElement;
const modelNameInput = shadow.getElementById('model-name') as HTMLInputElement;
const taskInput = shadow.getElementById('task') as HTMLTextAreaElement;
const runBtn = shadow.getElementById('run-btn') as HTMLButtonElement;
const logsDiv = shadow.getElementById('logs') as HTMLDivElement;

const log = (msg: string) => {
  logsDiv.textContent += msg + '\n';
  logsDiv.scrollTop = logsDiv.scrollHeight;
};

// Load target content and execute scripts
fetch('/target.html').then(res => res.text()).then(html => {
  const root = document.getElementById('app-root');
  if (root) {
    root.innerHTML = html;
    
    // Re-inject scripts to make them executable (innerHTML doesn't run scripts)
    Array.from(root.querySelectorAll('script')).forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
      newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }
});

runBtn.onclick = async () => {
  const apiKey = apiKeyInput.value.trim();
  const baseUrl = baseUrlInput.value.trim();
  const modelName = modelNameInput.value.trim();
  const task = taskInput.value.trim();

  if (!apiKey && !baseUrl) {
    alert('Please enter API Key (or Base URL for local models)');
    return;
  }

  runBtn.disabled = true;
  logsDiv.textContent = '';
  log('Initializing agent...');

  try {
    // Create the agent using createCustomAgent which supports OpenAI-compatible providers
    // and now supports passing callbacks via options
    const agent = await createCustomAgent({
      apiKey,
      baseURL: baseUrl || undefined,
      modelName
    }, {
      onThink: (thought) => log(`🧠 ${thought}`),
      onAction: (action, result) => {
        log(`⚡ Action: ${action.action} ${action.action === 'type' ? `"${action.text}"` : ''}`);
        if (!result.success) {
          log(`❌ Failed: ${result.message}`);
        }
      }
    });

    log(`🚀 Starting task: ${task}`);
    
    // Execute task using Planner-Actor architecture
    await agent.execute(task);
    
    log('✅ Task sequence completed.');
    
  } catch (err) {
    log(`❌ Error: ${err}`);
    console.error(err);
    log('Make sure @langchain/openai is installed.');
  } finally {
    runBtn.disabled = false;
  }
};
