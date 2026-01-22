
export class BackendGeminiProxy {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async invoke(messages: any[]) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ messages }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || `Backend error: ${response.statusText}`)
            }

            const data = await response.json()
            return { content: data.content }
        } catch (error) {
            console.error('Proxy invocation failed:', error)
            throw error
        }
    }
}
