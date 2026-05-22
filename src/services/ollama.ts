import { Product, Store, PriceEntry, QueryResult } from '../types';
import { products, stores, prices, getPricesForProduct, findCheapestPrice, getProductById, getStoreById } from '../data/superMarkets';
import { buildFactsBlock, searchProducts, allStores } from './priceIndex';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Get Ollama URL from environment or use default
// For mobile, you need to use your computer's IP address, not localhost
const getOllamaUrl = (): string => {
  // On web, always use localhost (Ollama binds to 127.0.0.1 by default)
  if (Platform.OS === 'web') {
    return 'http://localhost:11434';
  }

  // Native: derive computer's IP from Expo hostUri so the device can reach the host
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:11434`;
  }

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
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
    
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

  // Build a focused, pre-sorted context for the LLM.
  //
  // Strategy: do the heavy lifting in code (search, sort, aggregate) and let
  // the LLM only handle phrasing. The facts block is generated from the
  // pre-built indexes in ./priceIndex, so it's O(1) lookup per match instead
  // of scanning ~16k prices on every query.
  private buildPriceContext(userMessage: string, language: 'en' | 'el'): string {
    const storeList = allStores
      .map((s) => (language === 'el' ? s.nameGreek : s.name))
      .join(', ');

    // TSV is ~40% fewer tokens than prose for the same data.
    const facts = buildFactsBlock(userMessage, language, 8, 'tsv');

    const intro =
      language === 'el'
        ? `Είσαι βοηθός σύγκρισης τιμών σε ελληνικά σούπερ μάρκετ. Καταστήματα: ${storeList}.`
        : `You are a Greek supermarket price comparison assistant. Stores: ${storeList}.`;

    if (!facts) {
      return (
        intro +
        '\n\n' +
        (language === 'el'
          ? 'Δεν βρέθηκαν σχετικά προϊόντα στη βάση δεδομένων για αυτό το ερώτημα. Πες το ευγενικά στον χρήστη.'
          : 'No relevant products were found in the database for this query. Politely tell the user.')
      );
    }

    const dataHeader =
      language === 'el'
        ? 'Δεδομένα (TSV, ταξινομημένα από τη φθηνότερη τιμή, rank=1 είναι το φθηνότερο):'
        : 'Data (TSV, sorted cheapest-first, rank=1 is the cheapest):';

    const rules =
      language === 'el'
        ? 'Χρησιμοποίησε ΜΟΝΟ τα παραπάνω δεδομένα. Μην εφεύρεις τιμές ή καταστήματα. Ξεκίνα πάντα με το φθηνότερο κατάστημα (rank=1). Απάντησε σε φυσική γλώσσα, όχι TSV.'
        : 'Use ONLY the data above. Do not invent prices or stores. Always lead with the cheapest store (rank=1). Respond in natural language, not TSV.';

    return [intro, '', dataHeader, '```tsv', facts, '```', '', rules].join('\n');
  }

  // Fallback response when Ollama is not available. Uses the same precomputed
  // index as the LLM path so users still get a useful (if less natural) answer.
  private getFallbackResponse(userMessage: string, language: string): QueryResult {
    const lang: 'en' | 'el' = language === 'el' ? 'el' : 'en';
    const matches = searchProducts(userMessage, 5);

    if (matches.length === 0) {
      return {
        answer:
          lang === 'el'
            ? 'Δεν βρήκα σχετικά προϊόντα. Δοκίμασε άλλες λέξεις κλειδιά.'
            : "I couldn't find any matching products. Try different keywords.",
      };
    }

    const facts = buildFactsBlock(userMessage, lang, 5, 'human');
    return {
      answer: facts,
      products: matches.map((m) => m.product),
    };
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
    const lang: 'en' | 'el' = language === 'el' ? 'el' : 'en';
    const systemPrompt = this.buildPriceContext(userMessage, lang);

    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const answer = await this.chat(messages);

    // Surface the same matched products we showed the model, so the UI can
    // link / highlight them deterministically without scanning the LLM output.
    const mentionedProducts = searchProducts(userMessage, 8).map((f) => f.product);

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
