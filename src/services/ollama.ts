import { Product, Store, PriceEntry, QueryResult } from '../types';
import { products, stores, prices, getPricesForProduct, findCheapestPrice, getProductById, getStoreById } from '../data/superMarkets';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const MODEL_NAME = 'llama3.2'; // or whichever model you have installed

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

  constructor(baseUrl: string = OLLAMA_BASE_URL, model: string = MODEL_NAME) {
    this.baseUrl = baseUrl;
    this.model = model;
  }

  // Check if Ollama is running
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Send a chat message to Ollama
  async chat(messages: OllamaMessage[]): Promise<string> {
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
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.statusText}`);
    }

    const data: OllamaResponse = await response.json();
    return data.message.content;
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

  // Process user query about prices
  async queryPrices(userMessage: string, language: string = 'en'): Promise<QueryResult> {
    const systemContext = this.buildPriceContext();
    
    let systemPrompt = systemContext;
    if (language === 'el') {
      systemPrompt += '\n\nRespond in Greek. Use Greek names for stores and products when appropriate.';
    } else {
      systemPrompt += '\n\nRespond in the language the user is using.';
    }

    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    try {
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
    } catch (error) {
      return {
        answer: `Sorry, I couldn't process your request. Make sure Ollama is running locally on port 11434. Error: ${error}`,
      };
    }
  }

  // Get cheapest price for a product
  async getCheapestPrice(productName: string, language: string = 'en'): Promise<QueryResult> {
    // Find product by name (English or Greek)
    const product = products.find(p => 
      p.name.toLowerCase() === productName.toLowerCase() ||
      p.nameGreek.toLowerCase() === productName.toLowerCase() ||
      p.nameGreek.includes(productName) ||
      p.name.includes(productName)
    );

    if (!product) {
      const answer = language === 'el' 
        ? `Δεν βρήκα το προϊόν "${productName}" στη βάση δεδομένων.`
        : `I couldn't find "${productName}" in the database.`;
      return { answer };
    }

    const cheapest = findCheapestPrice(product.id);
    if (!cheapest) {
      return {
        answer: language === 'el'
          ? `Δεν έχω διαθέσιμες τιμές για ${product.name}.`
          : `No prices available for ${product.name}.`,
      };
    }

    const store = getStoreById(cheapest.storeId);
    const allPrices = getPricesForProduct(product.id)
      .map(p => ({ store: getStoreById(p.storeId), price: p }))
      .filter(p => p.store);

    const answer = language === 'el'
      ? `Η φθηνότερη τιμή για ${product.nameGreek} (${product.name}) είναι €${cheapest.price.toFixed(2)} στο ${store?.nameGreek} (${store?.name}).\n\nΌλες οι τιμές:\n${allPrices.map(p => `- ${p.store?.nameGreek}: €${p.price.price.toFixed(2)}`).join('\n')}`
      : `The cheapest price for ${product.name} (${product.nameGreek}) is €${cheapest.price.toFixed(2)} at ${store?.name}.\n\nAll prices:\n${allPrices.map(p => `- ${p.store?.name}: €${p.price.price.toFixed(2)}`).join('\n')}`;

    return {
      answer,
      products: [product],
      prices: allPrices.map(p => p.price),
      cheapestStore: store,
    };
  }
}

export const ollamaService = new OllamaService();
export default OllamaService;
