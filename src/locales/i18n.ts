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
      retry: 'Retry',
      
      // Sample Questions
      sampleQuestions: 'Try asking:',
      sample1: 'What is the cheapest milk?',
      sample2: 'Compare feta cheese prices',
      sample3: 'How much is olive oil?',
      
      // Errors
      errorNoConnection: 'Cannot connect to Ollama',
      errorGeneric: 'Something went wrong',

      // Basket
      basket: 'Basket',
      basketEmpty: 'Your basket is empty.',
      basketHint: 'Tap "Add" on any product to compare basket totals across stores.',
      basketAdd: 'Add',
      basketAdded: 'Added',
      basketRemove: 'Remove',
      basketClear: 'Clear basket',
      basketCompare: 'Compare across stores',
      basketCheapestStore: 'Cheapest store',
      basketTotal: 'Total',
      basketAvailableOf: 'has {{available}}/{{total}} items',
      basketMissing: '{{count}} not stocked',
      basketNoStores: 'No store carries any of these items.',
      basketClose: 'Close',

      // Create Basket
      basketCreate: 'Build basket by category',
      basketCreateTitle: 'Build basket',
      basketCreatePickCat: 'Pick a category',
      basketCreateAddSelected: 'Add {{count}} to basket',
      basketCreateNoSelection: 'Tap items to select',
      basketCreateSearch: 'Filter products…',

      // Type-your-list
      basketTypeList: 'Type your list',
      basketTypeListTitle: 'Type your shopping list',
      basketTypeListPlaceholder: 'e.g. 2 milk',
      basketTypeListAddRow: 'Add item',
      basketTypeListMatch: 'Match items',
      basketTypeListEdit: 'Edit list',
      basketTypeListAutoAdded: '{{count}} matched automatically',
      basketTypeListNeedsReview: 'Needs your choice ({{count}})',
      basketTypeListNotFound: 'No good matches ({{count}})',
      basketTypeListNoMatch: 'No product matched — search to add manually:',
      basketTypeListManualSearch: 'Search the catalog…',
      basketTypeListSkip: 'Skip',
      basketTypeListPickOne: 'Pick one:',
      basketTypeListConfirm: 'Add {{count}} to basket',

      // Price Tracker
      priceTracker: {
        title: 'Price Tracker',
        subtitle: 'Insights from the real Greek price catalog',
        all: 'All',
        // Overview stats
        totalProducts: 'Products',
        totalChains: 'Chains',
        totalPrices: 'Price points',
        avgPrice: 'Avg price',
        // Avg price trend card
        avgTrend: 'Avg price trend',
        avgTrendHint: 'Tap to compare with the {{date}} snapshot.',
        avgTrendHintNoBaseline: 'No earlier snapshot to compare against yet.',
        avgTrendModalHint: 'Each chain\'s current average price vs the {{date}} snapshot.',
        was: 'was',
        // Chain leaderboard
        chainLeaderboard: 'Cheapest chain leaderboard',
        chainLeaderboardHint: 'How many products each chain offers at the lowest price.',
        chainAvgInCategory: 'Avg price by chain',
        chainAvgHint: 'Average product price each chain charges in this category (lower wins).',
        winsIn: '{{wins}} wins · stocks {{stocked}}',
        avgIn: 'avg over {{count}} products',
        // Deals
        topDeals: 'Biggest price differences',
        topDealsHint: 'Products where switching stores saves the most.',
        // Table
        fullPriceTable: 'Search the catalog',
        searchPlaceholder: 'Search products…',
        showingResults: 'Showing {{count}} products',
        stores: 'stores',
        spread: 'spread',
        more: 'more (refine search)',
        noResults: 'No products match.',
      },
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
      retry: 'Επανάληψη',
      
      // Sample Questions
      sampleQuestions: 'Δοκίμασε να ρωτήσεις:',
      sample1: 'Ποιο είναι το φθηνότερο γάλα;',
      sample2: 'Σύγκρινε τιμές φέτας',
      sample3: 'Πόσο είναι το ελαιόλαδο;',
      
      // Errors
      errorNoConnection: 'Δεν μπορώ να συνδεθώ με το Ollama',
      errorGeneric: 'Κάτι πήγε στραβά',

      // Basket
      basket: 'Καλάθι',
      basketEmpty: 'Το καλάθι σου είναι άδειο.',
      basketHint: 'Πάτησε "Προσθήκη" σε ένα προϊόν για να συγκρίνεις σύνολο ανά κατάστημα.',
      basketAdd: 'Προσθήκη',
      basketAdded: 'Προστέθηκε',
      basketRemove: 'Αφαίρεση',
      basketClear: 'Άδειασμα',
      basketCompare: 'Σύγκριση καταστημάτων',
      basketCheapestStore: 'Φθηνότερο κατάστημα',
      basketTotal: 'Σύνολο',
      basketAvailableOf: 'έχει {{available}}/{{total}} προϊόντα',
      basketMissing: '{{count}} δεν διατίθενται',
      basketNoStores: 'Κανένα κατάστημα δεν διαθέτει αυτά τα προϊόντα.',
      basketClose: 'Κλείσιμο',

      // Create Basket
      basketCreate: 'Δημιουργία καλαθιού ανά κατηγορία',
      basketCreateTitle: 'Δημιουργία καλαθιού',
      basketCreatePickCat: 'Διάλεξε κατηγορία',
      basketCreateAddSelected: 'Προσθήκη {{count}} στο καλάθι',
      basketCreateNoSelection: 'Πάτησε για να επιλέξεις',
      basketCreateSearch: 'Φίλτρο προϊόντων…',

      // Type-your-list
      basketTypeList: 'Πληκτρολόγησε τη λίστα',
      basketTypeListTitle: 'Πληκτρολόγησε τη λίστα ψωνιών',
      basketTypeListPlaceholder: 'π.χ. 2 γάλα',
      basketTypeListAddRow: 'Προσθήκη γραμμής',
      basketTypeListMatch: 'Αντιστοίχιση',
      basketTypeListEdit: 'Επεξεργασία λίστας',
      basketTypeListAutoAdded: '{{count}} βρέθηκαν αυτόματα',
      basketTypeListNeedsReview: 'Χρειάζεται επιλογή ({{count}})',
      basketTypeListNotFound: 'Δεν βρέθηκαν ({{count}})',
      basketTypeListNoMatch: 'Δεν βρέθηκε προϊόν — αναζήτησε χειροκίνητα:',
      basketTypeListManualSearch: 'Αναζήτηση στον κατάλογο…',
      basketTypeListSkip: 'Παράλειψη',
      basketTypeListPickOne: 'Διάλεξε ένα:',
      basketTypeListConfirm: 'Προσθήκη {{count}} στο καλάθι',

      // Price Tracker
      priceTracker: {
        title: 'Παρακολούθηση Τιμών',
        subtitle: 'Δεδομένα από τον πραγματικό ελληνικό κατάλογο τιμών',
        all: 'Όλα',
        // Overview stats
        totalProducts: 'Προϊόντα',
        totalChains: 'Αλυσίδες',
        totalPrices: 'Σημεία τιμών',
        avgPrice: 'Μέση τιμή',
        // Avg price trend card
        avgTrend: 'Τάση μέσης τιμής',
        avgTrendHint: 'Πάτησε για σύγκριση με τη φωτογραφία της {{date}}.',
        avgTrendHintNoBaseline: 'Δεν υπάρχει προηγούμενη φωτογραφία για σύγκριση.',
        avgTrendModalHint: 'Μέση τιμή ανά αλυσίδα σήμερα σε σύγκριση με τη φωτογραφία της {{date}}.',
        was: 'ήταν',
        // Chain leaderboard
        chainLeaderboard: 'Κατάταξη φθηνότερων αλυσίδων',
        chainLeaderboardHint: 'Σε πόσα προϊόντα κάθε αλυσίδα έχει τη φθηνότερη τιμή.',
        chainAvgInCategory: 'Μέση τιμή ανά αλυσίδα',
        chainAvgHint: 'Μέση τιμή προϊόντος ανά αλυσίδα σε αυτή την κατηγορία (μικρότερη κερδίζει).',
        winsIn: '{{wins}} νίκες · διαθέτει {{stocked}}',
        avgIn: 'μ.ό. σε {{count}} προϊόντα',
        // Deals
        topDeals: 'Μεγαλύτερες διαφορές τιμών',
        topDealsHint: 'Προϊόντα όπου η αλλαγή καταστήματος αποδίδει το πιο μεγάλο όφελος.',
        // Table
        fullPriceTable: 'Αναζήτηση στον κατάλογο',
        searchPlaceholder: 'Αναζήτηση προϊόντων…',
        showingResults: 'Εμφάνιση {{count}} προϊόντων',
        stores: 'καταστήματα',
        spread: 'εύρος',
        more: 'περισσότερα (φιλτράρετε)',
        noResults: 'Δεν βρέθηκαν προϊόντα.',
      },
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
