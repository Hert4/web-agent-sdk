
/* eslint-disable */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

dotenv.config({ override: true });

const app = express();
app.use(cors());
app.use(express.json());

const port = 3001;

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set in .env file');
} else {
  const key = process.env.GEMINI_API_KEY;
  console.log(`Loaded API Key: ${key.substring(0, 4)}...${key.substring(key.length - 4)} (Length: ${key.length})`);
  if (key === 'your_gemini_api_key_here') {
    console.error('ERROR: You are using the placeholder API key. Please update .env with your actual key.');
  }
}

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-3-flash-preview',
  temperature: 0,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    console.log('Received chat request with messages:', JSON.stringify(messages).substring(0, 100) + '...');

    const response = await model.invoke(messages);
    
    res.json({ content: response.content });
  } catch (error) {
    console.error('Error handling chat request:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});
