import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // App
      appName: 'SupermarketLLM',
      tagline: 'Find the best prices in Greek supermarkets',
      
      // Chat Screen
      chatTitle: 'Price Assistant',
      chatPlaceholder: 'Ask about prices...',
      sendButton: 'Send',
      
      // Status
      ollamaConnected: 'Ollama connected',
      ollamaDisconnected: 'Ollama not connected',
      ollamaHint: 'Make sure Ollama is running locally on port 11434',
      
      // Sample Questions
      sampleQuestions: 'Try asking:',
      sample1: 'What is the cheapest milk?',
      sample2: 'Compare feta cheese prices',
      sample3: 'How much is olive oil?',
      
      // Errors
      errorNoConnection: 'Cannot connect to Ollama',
      errorGeneric: 'Something went wrong',
    },
  },
  el: {
    translation: {
      // App
      appName: 'SupermarketLLM',
      tagline: 'Βρες τις καλύτερες τιμές στα ελληνικά σούπερ μάρκετ',
      
      // Chat Screen
      chatTitle: 'Βοηθός Τιμών',
      chatPlaceholder: 'Ρώτα για τιμές...',
      sendButton: 'Αποστολή',
      
      // Status
      ollamaConnected: 'Ollama συνδεδεμένο',
      ollamaDisconnected: 'Ollama δεν είναι συνδεδεμένο',
      ollamaHint: 'Βεβαιωθείτε ότι το Ollama τρέχει τοπικά στη θύρα 11434',
      
      // Sample Questions
      sampleQuestions: 'Δοκίμασε να ρωτήσεις:',
      sample1: 'Ποιο είναι το φθηνότερο γάλα;',
      sample2: 'Σύγκρινε τιμές φέτας',
      sample3: 'Πόσο είναι το ελαιόλαδο;',
      
      // Errors
      errorNoConnection: 'Δεν μπορώ να συνδεθώ με το Ollama',
      errorGeneric: 'Κάτι πήγε στραβά',
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
