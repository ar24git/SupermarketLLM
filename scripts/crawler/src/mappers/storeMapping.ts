export interface StoreInfo {
  id: string;
  name: string;
  nameGreek: string;
  chain: string;
}

// Maps Greek chain names from e-katanalotis to our store format
const CHAIN_MAP: Record<string, StoreInfo> = {
  'ΑΒ ΒΑΣΙΛΟΠΟΥΛΟΣ': { id: 'ab', name: 'AB Vasilopoulos', nameGreek: 'ΑΒ Βασιλόπουλος', chain: 'AB' },
  'AB ΒΑΣΙΛΟΠΟΥΛΟΣ': { id: 'ab', name: 'AB Vasilopoulos', nameGreek: 'ΑΒ Βασιλόπουλος', chain: 'AB' },
  'ΑΒ': { id: 'ab', name: 'AB Vasilopoulos', nameGreek: 'ΑΒ Βασιλόπουλος', chain: 'AB' },
  'ΣΚΛΑΒΕΝΙΤΗΣ': { id: 'sklavenitis', name: 'Sklavenitis', nameGreek: 'Σκλαβενίτης', chain: 'Sklavenitis' },
  'ΜΑΣΟΥΤΗΣ': { id: 'masoutis', name: 'Masoutis', nameGreek: 'Μασούτης', chain: 'Masoutis' },
  'LIDL': { id: 'lidl', name: 'Lidl', nameGreek: 'Lidl', chain: 'Lidl' },
  'MY MARKET': { id: 'mymarket', name: 'My Market', nameGreek: 'My Market', chain: 'My Market' },
  'MARKET IN': { id: 'marketin', name: 'Market In', nameGreek: 'Market In', chain: 'Market In' },
  'ΚΡΗΤΙΚΟΣ': { id: 'kritikos', name: 'Kritikos', nameGreek: 'Κρητικός', chain: 'Kritikos' },
  'ΧΑΛΚΙΑΔΑΚΗΣ': { id: 'halkiadakis', name: 'Halkiadakis', nameGreek: 'Χαλκιαδάκης', chain: 'Halkiadakis' },
  'ΓΑΛΑΞΙΑΣ': { id: 'galaxias', name: 'Galaxias', nameGreek: 'Γαλαξίας', chain: 'Galaxias' },
  'BAZAAR': { id: 'bazaar', name: 'Bazaar', nameGreek: 'Bazaar', chain: 'Bazaar' },
  'METRO': { id: 'metro', name: 'Metro', nameGreek: 'Metro', chain: 'Metro' },
  'ΕΛΟΜΑΣ': { id: 'elomas', name: 'Elomas', nameGreek: 'Έλομας', chain: 'Elomas' },
  'ΘΑΝΟΠΟΥΛΟΣ': { id: 'thanopoulos', name: 'Thanopoulos', nameGreek: 'Θανόπουλος', chain: 'Thanopoulos' },
  // Names as they appear on product detail pages
  'ΣΚΛΑΒΕΝΊΤΗΣ': { id: 'sklavenitis', name: 'Sklavenitis', nameGreek: 'Σκλαβενίτης', chain: 'Sklavenitis' },
  'ΑΒ ΒΑΣΙΛΌΠΟΥΛΟΣ': { id: 'ab', name: 'AB Vasilopoulos', nameGreek: 'ΑΒ Βασιλόπουλος', chain: 'AB' },
  'ΜΑΣΟΎΤΗΣ': { id: 'masoutis', name: 'Masoutis', nameGreek: 'Μασούτης', chain: 'Masoutis' },
  'SYNKA': { id: 'synka', name: 'Synka', nameGreek: 'Synka', chain: 'Synka' },
  'EFRESH': { id: 'efresh', name: 'eFresh', nameGreek: 'eFresh', chain: 'eFresh' },
  'XALKIADAKIS': { id: 'halkiadakis', name: 'Halkiadakis', nameGreek: 'Χαλκιαδάκης', chain: 'Halkiadakis' },
  'GALAXIAS': { id: 'galaxias', name: 'Galaxias', nameGreek: 'Γαλαξίας', chain: 'Galaxias' },
};

export function mapChainName(greekName: string): StoreInfo | null {
  // Try exact match first
  const normalized = greekName.trim().toUpperCase();
  if (CHAIN_MAP[normalized]) return CHAIN_MAP[normalized];

  // Try partial match
  for (const [key, info] of Object.entries(CHAIN_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return info;
    }
  }

  return null;
}

export function createStoreFromName(name: string): StoreInfo {
  const id = name
    .toLowerCase()
    .replace(/[^a-zα-ω0-9]/gi, '')
    .replace(/[α-ω]/g, (c) => greekToLatin(c))
    .slice(0, 20);

  return {
    id,
    name: name.trim(),
    nameGreek: name.trim(),
    chain: name.trim(),
  };
}

function greekToLatin(char: string): string {
  const map: Record<string, string> = {
    'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z',
    'η': 'i', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
    'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's',
    'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps',
    'ω': 'o', 'ά': 'a', 'έ': 'e', 'ή': 'i', 'ί': 'i', 'ό': 'o',
    'ύ': 'y', 'ώ': 'o', 'ϊ': 'i', 'ϋ': 'y',
  };
  return map[char] || char;
}

export function getAllKnownStores(): StoreInfo[] {
  const seen = new Set<string>();
  const stores: StoreInfo[] = [];
  for (const info of Object.values(CHAIN_MAP)) {
    if (!seen.has(info.id)) {
      seen.add(info.id);
      stores.push(info);
    }
  }
  return stores;
}
