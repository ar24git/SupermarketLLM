// App configuration
// Copy this file to config.ts and update values

export const config = {
  // Ollama configuration
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
  },
  
  // Supported languages
  languages: ['en', 'el'],
  defaultLanguage: 'en',
  
  // App info
  appName: 'SupermarketLLM',
  version: '1.0.0',
};
