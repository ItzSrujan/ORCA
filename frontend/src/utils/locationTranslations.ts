/**
 * ORCA Location & Marine Telemetry Translation Utilities
 * Provides comprehensive Hindi (hi) and Marathi (mr) translations for
 * Indian coastal states, major harbors, INCOIS PFZ landing centers,
 * tidal statuses, and marine telemetry units.
 */

export const STATE_TRANSLATIONS: Record<string, { hi: string; mr: string }> = {
  // Western Coast
  'Gujarat': { hi: 'गुजरात', mr: 'गुजरात' },
  'Maharashtra': { hi: 'महाराष्ट्र', mr: 'महाराष्ट्र' },
  'Goa': { hi: 'गोवा', mr: 'गोवा' },
  'Karnataka': { hi: 'कर्नाटक', mr: 'कर्नाटक' },
  'Kerala': { hi: 'केरल', mr: 'केरळ' },
  'Daman and Diu': { hi: 'दमन और दीव', mr: 'दमन आणि दीव' },
  'Daman & Diu': { hi: 'दमन और दीव', mr: 'दमन आणि दीव' },

  // Eastern Coast
  'North Andhra Pradesh': { hi: 'उत्तर आंध्र प्रदेश', mr: 'उत्तर आंध्र प्रदेश' },
  'South Andhra Pradesh': { hi: 'दक्षिण आंध्र प्रदेश', mr: 'दक्षिण आंध्र प्रदेश' },
  'Andhra Pradesh': { hi: 'आंध्र प्रदेश', mr: 'आंध्र प्रदेश' },
  'North Tamil Nadu': { hi: 'उत्तर तमिलनाडु', mr: 'उत्तर तामिळनाडू' },
  'South Tamil Nadu': { hi: 'दक्षिण तमिलनाडु', mr: 'दक्षिण तामिळनाडू' },
  'Tamil Nadu': { hi: 'तमिलनाडु', mr: 'तामिळनाडू' },
  'Odisha': { hi: 'ओडिशा', mr: 'ओडिशा' },
  'West Bengal': { hi: 'पश्चिम बंगाल', mr: 'पश्चिम बंगाल' },
  'Puducherry': { hi: 'पुडुचेरी', mr: 'पुडुचेरी' },
  'Pondicherry': { hi: 'पुडुचेरी', mr: 'पुडुचेरी' },

  // Island Territories
  'Lakshadweep': { hi: 'लक्षद्वीप', mr: 'लक्षद्वीप' },
  'Andaman and Nicobar': { hi: 'अंडमान और निकोबार', mr: 'अंदमान आणि निकोबार' },
  'Andaman & Nicobar': { hi: 'अंडमान और निकोबार', mr: 'अंदमान आणि निकोबार' },
};

export const PORT_TRANSLATIONS: Record<string, { hi: string; mr: string }> = {
  // Maharashtra
  'Vijaydurg': { hi: 'विजयदुर्ग', mr: 'विजयदुर्ग' },
  'Bordi': { hi: 'बोर्डी', mr: 'बोर्डी' },
  'Dahanu': { hi: 'दहानू', mr: 'डहाणू' },
  'Palghar': { hi: 'पालघर', mr: 'पालघर' },
  'Satpati': { hi: 'सातपाटी', mr: 'सातपाटी' },
  'Vasai': { hi: 'वसई', mr: 'वसई' },
  'Arnala': { hi: 'अरनाळा', mr: 'अर्नाळा' },
  'Uttan': { hi: 'उत्तण', mr: 'उत्तण' },
  'Madh': { hi: 'मढ', mr: 'मढ' },
  'Versova': { hi: 'वर्सोवा', mr: 'वर्सोवा' },
  'Mumbai': { hi: 'मुंबई', mr: 'मुंबई' },
  'Sassoon Dock': { hi: 'ससून डॉक', mr: 'ससून डॉक' },
  'Karanja': { hi: 'कारंजा', mr: 'कारंजा' },
  'Mora': { hi: 'मोरा', mr: 'मोरा' },
  'Alibaug': { hi: 'अलीबाग', mr: 'अलिबाग' },
  'Alibag': { hi: 'अलिबाग', mr: 'अलिबाग' },
  'Revdanda': { hi: 'रेवदंडा', mr: 'रेवदंडा' },
  'Revadanda': { hi: 'रेवदंडा', mr: 'रेवदंडा' },
  'Murud': { hi: 'मुरुड', mr: 'मुरुड' },
  'Rajpuri': { hi: 'राजपुरी', mr: 'राजपुरी' },
  'Diveagar': { hi: 'दिवेआगर', mr: 'दिवेआगर' },
  'Srivardhan': { hi: 'श्रीवर्धन', mr: 'श्रीवर्धन' },
  'Shrivardhan': { hi: 'श्रीवर्धन', mr: 'श्रीवर्धन' },
  'Velas': { hi: 'वेलास', mr: 'वेलास' },
  'Bankot': { hi: 'बाणकोट', mr: 'बाणकोट' },
  'Kelshi': { hi: 'केळशी', mr: 'केळशी' },
  'AadeUttambar': { hi: 'आडे उत्तंबर', mr: 'आडे उत्तंबर' },
  'Harnai': { hi: 'हर्णे', mr: 'हर्णे' },
  'Harne': { hi: 'हर्णे', mr: 'हर्णे' },
  'HarnePort': { hi: 'हर्णे बंदरगाह', mr: 'हर्णे बंदर' },
  'Anjarle': { hi: 'आंजर्ले', mr: 'आंजर्ले' },
  'Anjanvel': { hi: 'अंजनवेल', mr: 'अंजनवेल' },
  'Dabhol': { hi: 'दाभोळ', mr: 'दाभोळ' },
  'Jaigad': { hi: 'जयगड', mr: 'जयगड' },
  'Jaigarh Head': { hi: 'जयगड हेड', mr: 'जयगड हेड' },
  'Ratnagiri': { hi: 'रत्नागिरी', mr: 'रत्नागिरी' },
  'Mirya': { hi: 'मिऱ्या', mr: 'मिऱ्या' },
  'Bhatye': { hi: 'भाट्ये', mr: 'भाट्ये' },
  'Purnagad': { hi: 'पूर्णगड', mr: 'पूर्णगड' },
  'Jaitapur': { hi: 'जैतापूर', mr: 'जैतापूर' },
  'Devgad': { hi: 'देवगड', mr: 'देवगड' },
  'Achara': { hi: 'आचरा', mr: 'आचरा' },
  'Malvan': { hi: 'मालवण', mr: 'मालवण' },
  'Tarkarli': { hi: 'तारकर्ली', mr: 'तारकर्ली' },
  'Vengurla': { hi: 'वेंगुर्ला', mr: 'वेंगुर्ला' },
  'Shiroda': { hi: 'शिरोडा', mr: 'शिरोडा' },

  // Goa
  'Chapora': { hi: 'चपोरा', mr: 'चपोरा' },
  'Aguada': { hi: 'अगुआडा', mr: 'अगुआडा' },
  'Panaji': { hi: 'पणजी', mr: 'पणजी' },
  'Panaji (Malim)': { hi: 'पणजी (मालिम)', mr: 'पणजी (मालिम)' },
  'Santerem Pt (Vasco)': { hi: 'वास्को', mr: 'वास्को' },
  'Vasco': { hi: 'वास्को', mr: 'वास्को' },
  'Mormugao': { hi: 'मोरमुगाओ', mr: 'मुरगाव' },
  'Majorde': { hi: 'माजोर्डा', mr: 'माजोर्डा' },
  'Cutbona': { hi: 'कुटबोना', mr: 'कुटबोना' },
  'Betul': { hi: 'बेतुल', mr: 'बेतुल' },
  'Talpona': { hi: 'तल्पोना', mr: 'तळपोणा' },

  // Karnataka
  'Karwar': { hi: 'कारवार', mr: 'कारवार' },
  'Belekeri': { hi: 'बेलेकेरी', mr: 'बेलेकेरी' },
  'Tadri': { hi: 'ताद्री', mr: 'ताद्री' },
  'Honnavar': { hi: 'होन्नावर', mr: 'होन्नावर' },
  'Bhatkal': { hi: 'भटकल', mr: 'भटकळ' },
  'Gangolli': { hi: 'गंगोली', mr: 'गंगोळी' },
  'Hangarkatta': { hi: 'हंगरकट्ठा', mr: 'हंगरकट्ठा' },
  'Malpe': { hi: 'मालपे', mr: 'मालपे' },
  'Mangalore': { hi: 'मंगलौर', mr: 'मंगळूर' },

  // Gujarat
  'Jakhau': { hi: 'जखाऊ', mr: 'जखाऊ' },
  'Mitha Port': { hi: 'मीठा बंदरगाह', mr: 'मीठा बंदर' },
  'Moti Akri': { hi: 'मोती अकरी', mr: 'मोती अकरी' },
  'Kadoli': { hi: 'कडोली', mr: 'कडोली' },
  'Khuada': { hi: 'खुअदा', mr: 'खुअदा' },
  'Lakhapat': { hi: 'लखपत', mr: 'लखपत' },
  'Kandla': { hi: 'कांडला', mr: 'कांडला' },
  'Mundra': { hi: 'मुंद्रा', mr: 'मुंद्रा' },
  'Mandvi': { hi: 'मांडवी', mr: 'मांडवी' },
  'Tuna Port': { hi: 'टूना बंदरगाह', mr: 'टुना बंदर' },
  'Bhadreshwar': { hi: 'भद्रेश्वर', mr: 'भद्रेश्वर' },
  'Navlakhi': { hi: 'नवलखी', mr: 'नवलखी' },
  'Bedi': { hi: 'बेदी', mr: 'बेदी' },
  'Sikka': { hi: 'सिक्का', mr: 'सिक्का' },
  'Salaya': { hi: 'सलाया', mr: 'सलाया' },
  'Okha': { hi: 'ओखा', mr: 'ओखा' },
  'Dwarka': { hi: 'द्वारका', mr: 'द्वारका' },
  'Porbandar': { hi: 'पोरबंदर', mr: 'पोरबंदर' },
  'Navabandar': { hi: 'नवा बंदर', mr: 'नवा बंदर' },
  'Mangrol': { hi: 'मांगरोल', mr: 'मांगरोल' },
  'Veraval': { hi: 'वेरावल', mr: 'वेरावल' },
  'Kotda': { hi: 'कोटडा', mr: 'कोटडा' },
  'Madhwad': { hi: 'मधवाड', mr: 'मधवाड' },
  'Diu': { hi: 'दीव', mr: 'दीव' },
  'Jafrabad': { hi: 'जाफराबाद', mr: 'जाफराबाद' },
  'Pipavav': { hi: 'पिपावाव', mr: 'पिपावाव' },
  'Bhavnagar': { hi: 'भावनगर', mr: 'भावनगर' },
  'Alang': { hi: 'अलंग', mr: 'अलंग' },
  'Dahej': { hi: 'दहेज', mr: 'दहेज' },
  'Hazira': { hi: 'हजीरा', mr: 'हजीरा' },
  'Surat': { hi: 'सूरत', mr: 'सुरत' },
  'Valsad': { hi: 'वलसाड', mr: 'वलसाड' },
  'Daman': { hi: 'दमन', mr: 'दमन' },

  // Kerala
  'Kochi': { hi: 'कोच्चि', mr: 'कोची' },
  'Cochin': { hi: 'कोच्चि', mr: 'कोची' },
  'Beypore': { hi: 'बेपोर', mr: 'बेपोर' },
  'Kollam': { hi: 'कोल्लम', mr: 'कोल्लम' },
  'Vizhinjam': { hi: 'विझिंजम', mr: 'विझिंजम' },
  'Munambam': { hi: 'मुनंबम', mr: 'मुनंबम' },
  'Thoppumpady': { hi: 'थोप्पुमपडी', mr: 'थोप्पुमपडी' },
  'Vypeen': { hi: 'वाइपीन', mr: 'वाइपीन' },
  'Calicut': { hi: 'कोझिकोड', mr: 'कोझिकोड' },
  'Kannur': { hi: 'कन्नूर', mr: 'कन्नूर' },
  'Kasargod': { hi: 'कासरगोड', mr: 'कासारगोड' },
  'Alappuzha': { hi: 'अलप्पुझा', mr: 'अलप्पुझा' },
  'Alleppey': { hi: 'अलप्पुझा', mr: 'अलप्पुझा' },

  // Tamil Nadu
  'Kasimedu': { hi: 'कासिमेडू', mr: 'कासिमेडू' },
  'Chennai': { hi: 'चेन्नई', mr: 'चेन्नई' },
  'Royapuram': { hi: 'रॉयपुरम', mr: 'रॉयपुरम' },
  'Ennore': { hi: 'एन्नोर', mr: 'एन्नोर' },
  'Pulicat': { hi: 'पुलिकट', mr: 'पुलिकट' },
  'Cuddalore': { hi: 'कुड्डालोर', mr: 'कड्डालोर' },
  'Nagapattinam': { hi: 'नागापट्टिनम', mr: 'नागापट्टिनम' },
  'Poompuhar': { hi: 'पूमपुहार', mr: 'पूमपुहार' },
  'Mallipatnam': { hi: 'मल्लीपट्टिनम', mr: 'मल्लीपट्टिनम' },
  'Tuticorin': { hi: 'तूतीकोरिन', mr: 'तुतीकोरिन' },
  'Thoothukudi': { hi: 'थूथुकुडी', mr: 'थूथुकुडी' },
  'Rameswaram': { hi: 'रामेश्वरम', mr: 'रामेश्वरम' },
  'Kanyakumari': { hi: 'कन्याकुमारी', mr: 'कन्याकुमारी' },
  'Colachel': { hi: 'कोलाचेल', mr: 'कोलाचेल' },

  // Andhra Pradesh
  'Visakhapatnam': { hi: 'विशाखापट्टनम', mr: 'विशाखापट्टणम' },
  'Ganguvada': { hi: 'गंगुवाडा', mr: 'गंगुवाडा' },
  'Kalingapatnam': { hi: 'कलिंगपटनम', mr: 'कलिंगपट्टणम' },
  'Bhavanapadu': { hi: 'भवनापाडु', mr: 'भवनापाडू' },
  'Kakinada': { hi: 'काकीनाडा', mr: 'काकीनाडा' },
  'Pedda Gollapalem': { hi: 'पेद्दा गोल्लापालेम', mr: 'पेद्दा गोल्लापालेम' },
  'Machilipatnam': { hi: 'मछलीपट्टनम', mr: 'मछलीपट्टणम' },
  'Nizampatnam': { hi: 'निजामपटनम', mr: 'निजामपट्टणम' },
  'Krishnapatnam': { hi: 'कृष्णपट्टनम', mr: 'कृष्णपट्टणम' },
  'Bapatla': { hi: 'बापटला', mr: 'बापटला' },
  'Ongole': { hi: 'ओंगोल', mr: 'ओंगोल' },
  'Nellore': { hi: 'नेल्लोर', mr: 'नेल्लोर' },

  // Odisha
  'Chandipur': { hi: 'चांदीपुर', mr: 'चांदीपूर' },
  'Paradip': { hi: 'पारादीप', mr: 'पारादीप' },
  'Gopalpur': { hi: 'गोपालपुर', mr: 'गोपालपूर' },
  'Puri': { hi: 'पुरी', mr: 'पुरी' },
  'Dhamra': { hi: 'धामरा', mr: 'धामरा' },
  'Astaranga': { hi: 'अस्तरंग', mr: 'अस्तरंग' },
  'Balaramgadi': { hi: 'बलरामगडी', mr: 'बलरामगडी' },

  // West Bengal
  'Digha': { hi: 'दीघा', mr: 'दीघा' },
  'DighaMohanaF.F.T.A.(Digha)': { hi: 'दीघा', mr: 'दीघा' },
  'Frazerganj': { hi: 'फ्रेजरगंज', mr: 'फ्रेझरगंज' },
  'Sankarpur': { hi: 'शंकरपुर', mr: 'शंकरपूर' },
  'Kakdwip': { hi: 'काकद्वीप', mr: 'काकद्विप' },
  'Namkhana': { hi: 'नामखाना', mr: 'नामखाना' },
  'Sultanpur': { hi: 'सुल्तानपुर', mr: 'सुलतानपूर' },
  'Diamond Harbour': { hi: 'डायमंड हार्बर', mr: 'डायमंड हार्बर' },
};

/**
 * Translates a single coastal state name.
 */
export function translateStateName(state: string, lang: string): string {
  if (!state || lang === 'en') return state;
  const cleanState = state.trim();
  const match = STATE_TRANSLATIONS[cleanState];
  if (match) {
    return lang === 'mr' ? match.mr : match.hi;
  }
  return state;
}

/**
 * Translates a coastal landing center / port name.
 */
export function translatePortName(port: string, lang: string): string {
  if (!port || lang === 'en') return port;
  const cleanPort = port.replace(/\(Digha\)/i, '').replace(/F\.F\.T\.A\./g, '').trim();
  const match = PORT_TRANSLATIONS[cleanPort] || PORT_TRANSLATIONS[port.trim()];
  if (match) {
    return lang === 'mr' ? match.mr : match.hi;
  }
  // Try matching base name without parenthesized suffix or Pt:
  const baseName = cleanPort.replace(/\s*\([^)]*\)/g, '').replace(/\s*Pt\.?/gi, '').trim();
  const baseMatch = PORT_TRANSLATIONS[baseName];
  if (baseMatch) {
    return lang === 'mr' ? baseMatch.mr : baseMatch.hi;
  }
  return cleanPort;
}

/**
 * Translates compound location strings like "Vijaydurg, Maharashtra" or "Kochi, Kerala".
 * Handles coordinates ("Coordinates (16.55°N, 73.33°E)"), "Live Location", "Safe Port: ...", etc.
 */
export function translateLocationName(location: string | undefined | null, lang: string): string {
  if (!location) return '';
  if (lang === 'en') return location;

  const loc = location.trim();

  // 1. Live location
  if (loc.toLowerCase().includes('live location') || loc.toLowerCase().includes('live gps')) {
    return lang === 'mr' ? 'थेट जीपीएस स्थान' : 'लाइव जीपीएस स्थान';
  }

  // 2. Coordinates pattern: "Coordinates (16.55°N, 73.33°E)" or similar
  const coordMatch = loc.match(/Coordinates\s*\(([^)]+)\)/i);
  if (coordMatch) {
    return lang === 'mr' ? `निर्देशांक (${coordMatch[1]})` : `निर्देशांक (${coordMatch[1]})`;
  }

  // 3. Safe port prefix: "Safe Port: Vijaydurg (42 km)"
  const safePrefixMatch = loc.match(/^Safe Port:\s*(.+)$/i);
  if (safePrefixMatch) {
    const inner = safePrefixMatch[1];
    const trans = translateLocationName(inner, lang);
    return lang === 'mr' ? `सुरक्षित बंदर: ${trans}` : `सुरक्षित बंदरगाह: ${trans}`;
  }

  // 4. Compound "Port, State" format: e.g. "Vijaydurg, Maharashtra"
  if (loc.includes(',')) {
    const parts = loc.split(',').map((p) => p.trim());
    const portPart = parts[0];
    const statePart = parts.slice(1).join(', ').trim();

    const translatedPort = translatePortName(portPart, lang);
    const translatedState = translateStateName(statePart, lang);

    return `${translatedPort}, ${translatedState}`;
  }

  // 5. Try direct match in port dictionary
  const directPort = translatePortName(loc, lang);
  if (directPort !== loc) return directPort;

  // 6. Try direct match in state dictionary
  const directState = translateStateName(loc, lang);
  if (directState !== loc) return directState;

  return loc;
}

/**
 * Translates tide status strings like "Rising", "Falling", "Unavailable".
 */
export function translateTideStatus(status: string | undefined | null, lang: string): string {
  if (!status || lang === 'en') return status || 'Unavailable';
  const s = status.toLowerCase().trim();
  if (s.includes('rising')) {
    return lang === 'mr' ? 'भरती' : 'बढ़ता ज्वार';
  }
  if (s.includes('falling')) {
    return lang === 'mr' ? 'ओहोटी' : 'घटता ज्वार';
  }
  if (s.includes('high')) {
    return lang === 'mr' ? 'उधाणाची भरती' : 'उच्च ज्वार';
  }
  if (s.includes('low')) {
    return lang === 'mr' ? 'भाटा' : 'निम्न ज्वार';
  }
  if (s.includes('unavailable') || s.includes('missing')) {
    return lang === 'mr' ? 'अनुपलब्ध' : 'अनुपलब्ध';
  }
  return status;
}

/**
 * Translates telemetry condition status labels like "Light breeze", "Moderate", "Calm", "Rough seas".
 */
export function translateTelemetryStatus(status: string | undefined | null, lang: string): string {
  if (!status || lang === 'en') return status || '';
  const s = status.toLowerCase().trim();

  if (s.includes('light breeze') || s === 'light') {
    return lang === 'mr' ? 'मंद वारा' : 'हल्की हवा';
  }
  if (s.includes('moderate')) {
    return lang === 'mr' ? 'मध्यम' : 'मध्यम';
  }
  if (s.includes('rough')) {
    return lang === 'mr' ? 'खवळलेला समुद्र' : 'उछलती लहरें';
  }
  if (s.includes('calm')) {
    return lang === 'mr' ? 'शांत समुद्र' : 'शांत समुद्र';
  }
  if (s.includes('strong current') || s === 'strong') {
    return lang === 'mr' ? 'वेगवान प्रवाह' : 'तेज़ बहाव';
  }
  if (s.includes('normal flow') || s === 'normal') {
    return lang === 'mr' ? 'सामान्य प्रवाह' : 'सामान्य प्रवाह';
  }
  if (s.includes('telemetry missing') || s.includes('missing')) {
    return lang === 'mr' ? 'माहिती उपलब्ध नाही' : 'डेटा अनुपलब्ध';
  }
  if (s.includes('normal cycle') || s.includes('cycle')) {
    return lang === 'mr' ? 'सामान्य चक्र' : 'सामान्य चक्र';
  }
  if (s.includes('sheltered') || s.includes('safe harbor')) {
    return lang === 'mr' ? 'सुरक्षित बंदर' : 'सुरक्षित बंदरगाह';
  }
  if (s.includes('away')) {
    // e.g. "42 km away" -> "४२ किमी दूर"
    return status.replace(/km\s*away/i, lang === 'mr' ? 'किमी अंतरावर' : 'किमी दूर');
  }

  return status;
}

/**
 * Translates telemetry units (km/h, m, m/s).
 */
export function translateUnit(unit: string, lang: string): string {
  if (lang === 'en') return unit;
  if (unit === 'km/h') return lang === 'mr' ? 'किमी/तास' : 'किमी/घं';
  if (unit === 'm') return 'मी.';
  if (unit === 'km') return 'किमी';
  if (unit === 'm/s') return 'मी/से';
  return unit;
}

/**
 * Translates compass direction abbreviations (N, S, E, W, NW, SW, etc.).
 */
export function translateDirection(dir: string | undefined | null, lang: string): string {
  if (!dir || lang === 'en') return dir || '';
  const d = dir.toUpperCase().trim();
  const DIR_MAP: Record<string, { hi: string; mr: string }> = {
    'N': { hi: 'उत्तर', mr: 'उत्तर' },
    'S': { hi: 'दक्षिण', mr: 'दक्षिण' },
    'E': { hi: 'पूर्व', mr: 'पूर्व' },
    'W': { hi: 'पश्चिम', mr: 'पश्चिम' },
    'NE': { hi: 'उत्तर-पूर्व', mr: 'ईशान्य' },
    'NW': { hi: 'उत्तर-पश्चिम', mr: 'वायव्य' },
    'SE': { hi: 'दक्षिण-पूर्व', mr: 'आग्नेय' },
    'SW': { hi: 'दक्षिण-पश्चिम', mr: 'नैऋत्य' },
    'NNE': { hi: 'उत्तर-उत्तर-पूर्व', mr: 'उत्तर-ईशान्य' },
    'NNW': { hi: 'उत्तर-उत्तर-पश्चिम', mr: 'उत्तर-वायव्य' },
    'ENE': { hi: 'पूर्व-उत्तर-पूर्व', mr: 'पूर्व-ईशान्य' },
    'WNW': { hi: 'पश्चिम-उत्तर-पश्चिम', mr: 'पश्चिम-वायव्य' },
    'ESE': { hi: 'पूर्व-दक्षिण-पूर्व', mr: 'पूर्व-आग्नेय' },
    'WSW': { hi: 'पश्चिम-दक्षिण-पश्चिम', mr: 'पश्चिम-नैऋत्य' },
    'SSE': { hi: 'दक्षिण-दक्षिण-पूर्व', mr: 'दक्षिण-आग्नेय' },
    'SSW': { hi: 'दक्षिण-दक्षिण-पश्चिम', mr: 'दक्षिण-नैऋत्य' },
  };
  if (DIR_MAP[d]) {
    return lang === 'mr' ? DIR_MAP[d].mr : DIR_MAP[d].hi;
  }
  return dir;
}
