<template>
	<div class="fixed bottom-4 right-4 z-50 font-sans">
		<button
			v-if="!isOpen"
			@click="isOpen = true"
			class="bg-k-main text-k-black p-4 rounded-full shadow-lg hover:bg-yellow-400 transition-colors"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.159 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
			</svg>
		</button>

		<div v-else class="w-96 bg-white rounded-lg shadow-2xl flex flex-col max-h-[80vh] border border-gray-200">
			<div class="p-4 bg-k-black text-white rounded-t-lg flex justify-between items-center">
				<h3 class="font-bold">Web Agent</h3>
				<div class="flex items-center space-x-2">
					<button 
						v-if="isProcessing" 
						@click="stopExecution" 
						class="text-red-400 hover:text-red-300 text-xs font-bold px-2 py-1 border border-red-400 rounded"
						title="Stop execution"
					>
						STOP
					</button>
					<button 
						@click="resetChat" 
						class="text-gray-400 hover:text-white"
						title="New Chat (Clear History)"
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
						</svg>
					</button>
					<button @click="isOpen = false" class="text-gray-400 hover:text-white">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]" ref="messagesContainer">
				<div v-for="(msg, i) in messages" :key="i" :class="['flex', msg.role === 'user' ? 'justify-end' : 'justify-start']">
					<div
						:class="[
							'max-w-[85%] rounded-lg p-3 text-sm shadow-sm',
							msg.role === 'user' ? 'bg-k-main text-k-black' : 'bg-white border border-gray-200 text-gray-800'
						]"
					>
						<!-- Progress Bar for active agent message -->
						<div v-if="msg.role === 'agent' && isProcessing && i === messages.length - 1" class="mb-3">
							<div class="flex justify-between items-center mb-1">
								<span class="text-xs font-bold text-gray-500 animate-pulse">Agent is working...</span>
								<span class="text-[10px] text-gray-400">{{ msg.thoughts?.length || 0 }} steps</span>
							</div>
							<div class="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
								<div class="h-full bg-k-main animate-progress origin-left"></div>
							</div>
						</div>

						<!-- Final Response Content -->
						<div v-if="msg.content" class="mb-1 font-medium">{{ msg.content }}</div>
						
						<!-- Collapsible Thoughts/Details -->
						<div v-if="msg.thoughts && msg.thoughts.length > 0">
							<button 
								@click="msg.showDetails = !msg.showDetails" 
								class="text-[10px] uppercase font-bold text-gray-400 hover:text-k-black transition-colors flex items-center gap-1 mt-2"
							>
								<span>{{ msg.showDetails ? 'Hide' : 'Show' }} Process</span>
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3 h-3 transition-transform duration-200" :class="msg.showDetails ? 'rotate-180' : ''">
									<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
								</svg>
							</button>

							<div v-if="msg.showDetails" class="mt-2 text-xs border-t border-gray-100 pt-2 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
								<div v-for="(thought, ti) in msg.thoughts" :key="ti" class="group">
									<div v-if="thought.type === 'action'" class="flex items-start gap-2">
										<span class="text-blue-500 mt-0.5">⚡</span>
										<span class="text-gray-700">{{ thought.text }}</span>
									</div>
									<div v-else class="flex items-start gap-2">
										<span class="text-gray-400 mt-0.5">💭</span>
										<span class="text-gray-500 italic">{{ thought.text }}</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="p-4 border-t border-gray-200">
				<div class="flex space-x-2">
					<input
						v-model="input"
						@keyup.enter="sendMessage"
						type="text"
						placeholder="Ask agent to do something..."
						class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-k-main"
						:disabled="isProcessing"
					/>
					<button
						@click="sendMessage"
						:disabled="!input.trim() || isProcessing"
						class="bg-k-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { LangChainWebAgent, type WebAction, type ActionResult } from 'web-agent-sdk'
import { BackendGeminiProxy } from '../agent/proxy-model'

interface Message {
	role: 'user' | 'agent'
	content?: string
	thoughts?: Array<{ type: 'thought' | 'action'; text: string }>
	showDetails?: boolean
}

const isOpen = ref(false)
const input = ref('')
const messages = ref<Message[]>([])
const isProcessing = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const currentTask = ref('')

const saveState = () => {
	localStorage.setItem('agent-messages', JSON.stringify(messages.value))
	localStorage.setItem('agent-state', agent.exportState())
	if (currentTask.value) {
		localStorage.setItem('agent-task', currentTask.value)
	} else {
		localStorage.removeItem('agent-task')
	}
}

const proxyModel = new BackendGeminiProxy()
const agent = new LangChainWebAgent({
	model: proxyModel,
	useStructuredOutput: false,
	debug: true,
	onThink: (thought: string) => {
		addThought('thought', thought)
		
		// Capture Agent Speech
		if (thought.startsWith('Agent Question:')) {
			updateLastMessageContent(thought.substring(15).trim())
		} 
		// Capture DONE message from Plan
		else if (thought.includes('Plan: DONE:')) {
			const text = thought.split('Plan: DONE:')[1].trim()
			updateLastMessageContent(text)
		}
		// Capture Completion from history log (sometimes logged directly)
		else if (thought.startsWith('Completion:')) {
			updateLastMessageContent(thought.substring(11).trim())
		}
	},
	onActionStart: (action: WebAction) => {
		addThought('action', `Starting: ${action.action}`)
		saveState()
	},
	onAction: (action: WebAction, result: ActionResult) => {
		addThought('action', `Completed: ${action.action} (${result.success ? 'Success' : 'Failed'})`)
		saveState()
	}
})

const updateLastMessageContent = (text: string) => {
	const lastMsg = messages.value[messages.value.length - 1]
	if (lastMsg && lastMsg.role === 'agent') {
		lastMsg.content = text
		scrollToBottom()
	}
}

const route = useRoute()
const SKILLS = {
	default: 'You are browsing an e-commerce store. Help the user find products, view details, and manage their cart.',
	home: 'In the Home page. Use the navigation menu to browse categories (Keyboards, Keycaps, Deskmats).',
	category: 'In this product category. You can filter products or click on product cards to view details.',
	product: 'In this product detail page. You can select options (switch type, layout) and Add to Cart.',
	checkout: 'In this Checkout. Fill in the shipping form. Ask the user for missing information if needed. Do not proceed to payment. Never make up information. Ask the user if unsure.'
}

watch(() => route.path, (path) => {
	let skills = SKILLS.default
	if (path === '/') skills += ' ' + SKILLS.home
	else if (path.includes('/keyboards') || path.includes('/keycaps') || path.includes('/deskmats')) {
		if (path.split('/').length > 2) skills += ' ' + SKILLS.product
		else skills += ' ' + SKILLS.category
	}
	else if (path === '/checkout') skills += ' ' + SKILLS.checkout
	
	if (agent.setSkills) {
		agent.setSkills(skills)
	} else {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(agent as any).config.skills = skills
	}
}, { immediate: true })

const addThought = (type: 'thought' | 'action', text: string) => {
	const lastMsg = messages.value[messages.value.length - 1]
	if (lastMsg && lastMsg.role === 'agent') {
		if (!lastMsg.thoughts) lastMsg.thoughts = []
		lastMsg.thoughts.push({ type, text })
		scrollToBottom()
	}
}

onMounted(async () => {
	const savedMessages = localStorage.getItem('agent-messages')
	if (savedMessages) {
		try {
			messages.value = JSON.parse(savedMessages)
			scrollToBottom()
		} catch (e) {
			console.error('Failed to restore messages', e)
		}
	}

	const savedState = localStorage.getItem('agent-state')
	let shouldResume = false
	if (savedState) {
		agent.importState(savedState)
		try {
			const stateObj = JSON.parse(savedState)
			if (stateObj.history && stateObj.history.length > 0) {
				const lastEntry = stateObj.history[stateObj.history.length - 1]
				if (!lastEntry.startsWith('Completion:')) {
					shouldResume = true
				}
			}
		} catch (e) {
			// ignore
		}
	}

	const savedTask = localStorage.getItem('agent-task')
	if (shouldResume && savedTask) {
		currentTask.value = savedTask
		isProcessing.value = true
		// Don't show 'Resuming' text in chat, just show progress bar
		// addThought('thought', 'Resuming task after navigation...')
		
		try {
			await agent.execute(savedTask, 10, true)
			
			// Check completion state to clear task
			const newState = JSON.parse(agent.exportState())
			const lastEntry = newState.history[newState.history.length - 1]
			if (lastEntry && lastEntry.startsWith('Completion:')) {
				// Content is already updated by onThink
				currentTask.value = ''
				saveState()
			}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			const lastMsg = messages.value[messages.value.length - 1]
			lastMsg.content = `Error: ${error.message || error}`
			currentTask.value = ''
			saveState()
		} finally {
			isProcessing.value = false
			scrollToBottom()
		}
	}
})

const scrollToBottom = async () => {
	await nextTick()
	if (messagesContainer.value) {
		messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
	}
}

const sendMessage = async () => {
	if (!input.value.trim() || isProcessing.value) return

	const userText = input.value
	messages.value.push({ role: 'user', content: userText })
	input.value = ''
	isProcessing.value = true
	currentTask.value = userText
	scrollToBottom()

	messages.value.push({ role: 'agent', thoughts: [], showDetails: false })
	saveState()

	try {
		let shouldResume = false
		try {
			const state = JSON.parse(agent.exportState())
			if (state.history && state.history.length > 0) {
				const lastEntry = state.history[state.history.length - 1]
				if (lastEntry && !lastEntry.startsWith('Completion:')) {
					shouldResume = true
				}
			}
		} catch (e) {
			// ignore
		}

		let taskWithContext = userText
		if (messages.value.length > 1) {
			const recentHistory = messages.value.slice(-6, -1)
			if (recentHistory.length > 0) {
				taskWithContext = `PREVIOUS CONVERSATION:\n${recentHistory.map(m => 
					`${m.role === 'user' ? 'User' : 'Agent'}: ${m.content || '(action)'}`
				).join('\n')}\n\nCURRENT REQUEST: ${userText}`
			}
		}

		await agent.execute(taskWithContext, 10, shouldResume)
		
		const lastMsg = messages.value[messages.value.length - 1]
		const newState = JSON.parse(agent.exportState())
		const lastEntry = newState.history[newState.history.length - 1]
		
		if (lastEntry && lastEntry.startsWith('Completion:')) {
			currentTask.value = '' // Clear task
		}
		
		// If no content was set by onThink (e.g. just actions), set a default
		if (!lastMsg.content) {
			lastMsg.content = 'I finished this step.'
		}
		saveState()
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} catch (error: any) {
		const lastMsg = messages.value[messages.value.length - 1]
		lastMsg.content = `Error: ${error.message || error}`
		currentTask.value = ''
		saveState()
	} finally {
		isProcessing.value = false
		scrollToBottom()
	}
}

const resetChat = () => {
	if (confirm('Start a new chat? This will clear all history.')) {
		messages.value = []
		localStorage.removeItem('agent-messages')
		localStorage.removeItem('agent-state')
		localStorage.removeItem('agent-task')
		window.location.reload()
	}
}

const stopExecution = () => {
	localStorage.removeItem('agent-task')
	window.location.reload()
}
</script>

<style scoped>
@keyframes progress {
  0% { transform: scaleX(0); }
  50% { transform: scaleX(0.5); }
  100% { transform: scaleX(1); }
}
.animate-progress {
  animation: progress 2s infinite linear;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 2px;
}
</style>
