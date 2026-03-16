import { Product, Store, PriceEntry, QueryResult } from '../types';
import { products, stores, prices, getPricesForProduct, findCheapestPrice, getProductById, getStoreById } from '../data/superMarkets';
import Constants from 'expo-constants';

// Get Ollama URL from environment or use default
// For mobile, you need to use your computer's IP address, not localhost
const getOllamaUrl = (): string => {
  // Check if we're in development mode
  const debuggerHost = Constants.expoConfig?.hostUri;
  
  if (debuggerHost) {
    // Running in Expo Go - extract IP from hostUri (format: "192.168.1.5:8081")
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:11434`;
  }
  
  // Fallback to localhost (for web/testing)
  return 'http://localhost:11434';
};

// ============================================
// CONFIGURATION - Change your LLM here!
// ============================================

// Model name - qwen2.5:7b is excellent for Greek + multilingual
// Alternative models you can try:
// - 'qwen2.5:7b' - Best for Greek/multilingual (recommended)
// - 'llama3.2:1b' - Fast, uses less RAM
// - 'llama3.2:3b' - Good balance of speed and quality
// - 'llama3:8b' - Larger, more capable
// - 'mistral' - Good all-rounder
//
// To install a new model:
//   ollama pull qwen2.5:7b
//   ollama pull llama3.2:3b
// ============================================
const OLLAMA_BASE_URL = getOllamaUrl();
const MODEL_NAME = 'qwen2.5:7b';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface OllamaResponse {
  message: {
    content: string;
  };
  done: boolean;
}

class OllamaService {
  private baseUrl: string;
  private model: string;
  private isConnected: boolean = false;

  constructor(baseUrl: string = OLLAMA_BASE_URL, model: string = MODEL_NAME) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  // Check if Ollama is running
  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      this.isConnected = response.ok;
      return response.ok;
    } catch {
      this.isConnected = false;
      return false;
    }
  }

  // Send a chat message to Ollama
  async chat(messages: OllamaMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.statusText}`);
      }

      const data: OllamaResponse = await response.json();
      return data.message.content;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Build context from price data
  private buildPriceContext(): string {
    let context = 'You are a helpful Greek supermarket price comparison assistant. ';
    context += 'You have access to price data from the following stores: ';
    context += stores.map(s => s.name).join(', ') + '. ';
    context += '\n\nAvailable products:\n';
    
    products.forEach(p => {
      context += `- ${p.name} (${p.nameGreek}): ${p.category}, ${p.unit}\n`;
    });
    
    context += '\nCurrent prices (EUR):\n';
    prices.forEach(p => {
      const product = getProductById(p.productId);
      const store = getStoreById(p.storeId);
      if (product && store) {
        context += `- ${product.name} at ${store.name}: €${p.price.toFixed(2)} per ${product.unit}\n`;
      }
    });
    
    return context;
  }

  // Fallback response when Ollama is not available
  private getFallbackResponse(userMessage: string, language: string): QueryResult {
    const message = userMessage.toLowerCase();
    
    // Try to find product mentioned
    const product = products.find(p => 
      message.includes(p.name.toLowerCase()) ||
      message.includes(p.nameGreek.toLowerCase())
    );

    if (!product) {
      return {
        answer: language === 'el' 
          ? 'Λυπάμαι, δεν μπορώ να συνδεθώ με το Ollama και δεν αναγνώρισα το προϊόν. Παρακαλώ ξεκίνα το Ollama στον υπολογιστή σου.'
          : 'Sorry, I cannot connect to Ollama and didn\'t recognize the product. Please start Ollama on your computer.',
      };
    }

    // Return cheapest price from local data
    return this.getCheapestPriceLocal(product, language);
  }

  // Get cheapest price using local data (no LLM)
  private getCheapestPriceLocal(product: Product, language: string): QueryResult {
    const cheapest = findCheapestPrice(product.id);
    
    if (!cheapest) {
      return {
        answer: language === 'el'
          ? `Δεν έχω διαθέσιμες τιμές για ${product.nameGreek}.`
          : `No prices available for ${product.name}.`,
        products: [product],
      };
    }

    const store = getStoreById(cheapest.storeId);
    const allPrices = getPricesForProduct(product.id)
      .map(p => ({ store: getStoreById(p.storeId), price: p }))
      .filter(p => p.store);

    const answer = language === 'el'
      ? `Η φθηνότερη τιμή για ${product.nameGreek} είναι €${cheapest.price.toFixed(2)} στο ${store?.nameGreek}.\n\nΌλες οι τιμές:\n${allPrices.map(p => `- ${p.store?.nameGreek}: €${p.price.price.toFixed(2)}`).join('\n')}`
      : `The cheapest price for ${product.name} is €${cheapest.price.toFixed(2)} at ${store?.name}.\n\nAll prices:\n${allPrices.map(p => `- ${p.store?.name}: €${p.price.price.toFixed(2)}`).join('\n')}`;

    return {
      answer,
      products: [product],
      prices: allPrices.map(p => p.price),
      cheapestStore: store,
    };
  }

  // Process user query about prices
  async queryPrices(userMessage: string, language: string = 'en'): Promise<QueryResult> {
    // First try to use Ollama
    if (this.isConnected) {
      try {
        return await this.queryWithOllama(userMessage, language);
      } catch (error) {
        console.log('Ollama query failed, using fallback:', error);
        // Fall through to local data
      }
    }

    // Fallback to local data
    return this.getFallbackResponse(userMessage, language);
  }

  // Query using Ollama LLM
  private async queryWithOllama(userMessage: string, language: string): Promise<QueryResult> {
    const systemContext = this.buildPriceContext();
    
    let systemPrompt = systemContext;
    if (language === 'el') {
      systemPrompt += '\n\nRespond in Greek (Ελληνικά). Use Greek names for stores and products. Be helpful and concise. If you don\'t have price data for a product, say so clearly.';
    } else {
      systemPrompt += '\n\nRespond in English. Be helpful and concise. If you don\'t have price data for a product, say so clearly.';
    }
    systemPrompt += '\n\nWhen comparing prices, always show the cheapest option first with the store name and price.';

    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const answer = await this.chat(messages);
    
    // Try to extract product mentions from the answer
    const mentionedProducts = products.filter(p => 
      answer.toLowerCase().includes(p.name.toLowerCase()) ||
      answer.toLowerCase().includes(p.nameGreek.toLowerCase())
    );

    return {
      answer,
      products: mentionedProducts,
    };
  }

  // Get cheapest price for a product (with Ollama or fallback)
  async getCheapestPrice(productName: string, language: string = 'en'): Promise<QueryResult> {
    // Find product by name
    const product = products.find(p => 
      p.name.toLowerCase() === productName.toLowerCase() ||
      p.nameGreek.toLowerCase() === productName.toLowerCase() ||
      p.nameGreek.toLowerCase().includes(productName.toLowerCase()) ||
      p.name.toLowerCase().includes(productName.toLowerCase())
    );

    if (!product) {
      const answer = language === 'el' 
        ? `Δεν βρήκα το προϊόν "${productName}" στη βάση δεδομένων.`
        : `I couldn't find "${productName}" in the database.`;
      return { answer };
    }

    // Use local data (fast and reliable)
    return this.getCheapestPriceLocal(product, language);
  }
}

export const ollamaService = new OllamaService();
export default OllamaService;
