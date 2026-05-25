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
      basketCreate: '+ Build basket by category',
      basketCreateTitle: 'Build basket',
      basketCreatePickCat: 'Pick a category',
      basketCreateAddSelected: 'Add {{count}} to basket',
      basketCreateNoSelection: 'Tap items to select',
      basketCreateSearch: 'Filter products…',

      // Type-your-list
      basketTypeList: '✎ Type your list',
      basketTypeListTitle: 'Type your shopping list',
      basketTypeListPlaceholder: 'One item per line\ne.g.\n- 2 milk\n- feta cheese 400g\n- olive oil',
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
        subtitle: 'Compare prices across supermarkets',
        search: 'Search items or categories:',
        searchPlaceholder: 'Search items or categories...',
        all: 'All',
        totalItems: 'Total Items',
        priceIncreases: 'Price ↑',
        priceDecreases: 'Price ↓',
        stablePrices: 'Stable →',
        bestStore: 'Best Store',
        worstStore: 'Worst Store',
        top15Comparison: 'Top 15 Items - Price Comparison',
        categoryBreakdown: 'Category Breakdown',
        priceDistribution: 'Price Change Distribution',
        fullPriceTable: 'Full Price Table',
        item: 'Item',
        category: 'Category',
        change: 'Change',
        noResults: 'No items found',
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
      basketCreate: '+ Δημιουργία καλαθιού ανά κατηγορία',
      basketCreateTitle: 'Δημιουργία καλαθιού',
      basketCreatePickCat: 'Διάλεξε κατηγορία',
      basketCreateAddSelected: 'Προσθήκη {{count}} στο καλάθι',
      basketCreateNoSelection: 'Πάτησε για να επιλέξεις',
      basketCreateSearch: 'Φίλτρο προϊόντων…',

      // Type-your-list
      basketTypeList: '✎ Πληκτρολόγησε τη λίστα',
      basketTypeListTitle: 'Πληκτρολόγησε τη λίστα ψωνιών',
      basketTypeListPlaceholder: 'Ένα προϊόν ανά γραμμή\nπ.χ.\n- 2 γάλα\n- φέτα 400g\n- ελαιόλαδο',
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
        subtitle: 'Σύγκρινε τιμές σε όλα τα σούπερ μάρκετ',
        search: 'Αναζήτηση προϊόντων ή κατηγοριών:',
        searchPlaceholder: 'Αναζήτηση προϊόντων ή κατηγοριών...',
        all: 'Όλα',
        totalItems: 'Σύνολο Προϊόντων',
        priceIncreases: 'Τιμή ↑',
        priceDecreases: 'Τιμή ↓',
        stablePrices: 'Σταθερή →',
        bestStore: 'Φθηνότερο Κατάστημα',
        worstStore: 'Ακριβότερο Κατάστημα',
        top15Comparison: 'Οι 15 Κορυφαία Προϊόντα',
        categoryBreakdown: 'Ανά κατηγορία',
        priceDistribution: 'Κατανομή Αλλαγών',
        fullPriceTable: 'Πίνακας Τιμών',
        item: 'Είδος',
        category: 'Κατηγορία',
        change: 'Αλλαγή',
        noResults: 'Δεν βρέθηκαν αποτελέσματα',
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
