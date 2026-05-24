import { Product, Store, PriceEntry, QueryResult } from '../types';
import { products, stores, prices, getPricesForProduct, findCheapestPrice, getProductById, getStoreById } from '../data/superMarkets';
import { buildFactsBlock, searchProducts, allStores } from './priceIndex';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ============================================
// CONFIGURATION
// ============================================
//
// We always talk to LOCAL Ollama on this machine — it acts as a transparent
// proxy. If you give it a model with the ":cloud" suffix (e.g.
// "qwen3-coder-next:cloud") and you've previously run `ollama signin`, the
// local daemon forwards to ollama.com for you. This avoids two problems:
//
//   1. CORS — ollama.com does not return Access-Control-Allow-Origin headers,
//      so the browser blocks direct cloud calls from the React Native web app.
//      Local daemon does send the right CORS headers.
//   2. Secret leakage — no API key needs to live in the JS bundle.
//
// Override the model via EXPO_PUBLIC_OLLAMA_MODEL in .env. Examples:
//   qwen3-coder-next:cloud  (default — cloud-backed, very accurate)
//   gemma4:e4b-mlx          (purely local, fast on Apple Silicon)
//   qwen2.5:7b              (purely local, more accurate but slower)
// ============================================

const DEFAULT_MODEL = 'qwen3-coder-next:cloud';

const getOllamaUrl = (): string => {
  if (Platform.OS === 'web') return 'http://localhost:11434';
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:11434`;
  }
  return 'http://localhost:11434';
};

const OLLAMA_BASE_URL = getOllamaUrl();
const MODEL_NAME = process.env.EXPO_PUBLIC_OLLAMA_MODEL ?? DEFAULT_MODEL;

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

  // Check if local Ollama is reachable (browser CORS friendly).
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

  // Send a chat message via local Ollama (which transparently proxies
  // :cloud models to ollama.com if you've run `ollama signin`).
  async chat(messages: OllamaMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    // One row per matching product, only the cheapest store. Minimal tokens
    // and minimal room for the LLM to misinterpret packaging codes.
    const facts = buildFactsBlock(userMessage, language, 8, 'cheapest');

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
        ? 'Δεδομένα: ένα προϊόν ανά γραμμή με τη φθηνότερη τιμή του:'
        : 'Data: one row per product with its cheapest price:';

    const rules =
      language === 'el'
        ? [
            'Κανόνες:',
            '- Χρησιμοποίησε ΜΟΝΟ τα δεδομένα. Μην εφεύρεις τιμές ή καταστήματα.',
            '- Μην αναλύεις τις συσκευασίες (π.χ. "12/1L"). Παρουσίασε τα ονόματα όπως είναι.',
            '- Μην ομαδοποιείς ούτε να κατηγοριοποιείς. Απλώς απαρίθμησε.',
            '- Απάντησε στα Ελληνικά, σε φυσική γλώσσα, σύντομα.',
          ].join('\n')
        : [
            'Rules:',
            '- Use ONLY the data above. Do not invent prices or stores.',
            '- Do not interpret packaging codes (e.g. "12/1L"). Show product names verbatim.',
            '- Do not group or recategorize. Just list them.',
            '- Respond in English, in natural language, concise.',
          ].join('\n');

    return [intro, '', dataHeader, '```', facts, '```', '', rules].join('\n');
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
