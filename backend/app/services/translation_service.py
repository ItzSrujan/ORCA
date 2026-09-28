"""Translation service — translates marine text between English, Hindi, and Marathi."""

from __future__ import annotations

import asyncio
import re
import urllib.parse
import httpx

from app.core.logging import get_logger
from app.llm import get_llm_provider

logger = get_logger("services.translation")

# Marine dictionary for offline/deterministic translation
DICTIONARY_HI = {
    # Headers & Labels
    "Weather at Your Current Location": "आपके वर्तमान स्थान पर मौसम",
    "Weather at current location": "वर्तमान स्थान पर मौसम",
    "Recommended Coastal Alternatives to": "के लिए अनुशंसित तटीय विकल्प",
    "Recommended Coastal Alternatives": "अनुशंसित तटीय विकल्प",
    "Active Fishing Area (PFZ)": "सक्रिय मत्स्य पालन क्षेत्र (पीएफजेड)",
    "Active Fishing Area": "सक्रिय मत्स्य पालन क्षेत्र",
    "Potential Fishing Zone (PFZ)": "संभाव्य मत्स्य क्षेत्र (पीएफजेड)",
    "Potential Fishing Zone": "संभाव्य मत्स्य क्षेत्र",
    "Coastal Alternatives": "तटीय विकल्प",
    "Fishing Advisory": "मत्स्य पालन सलाह",
    "Safety Advisory": "सुरक्षा सलाह",
    
    # Status & Risks
    "Favorable for operations": "परिचालन के लिए अनुकूल",
    "favorable for operations": "परिचालन के लिए अनुकूल",
    "Safe to proceed": "आगे बढ़ना सुरक्षित है",
    "SAFE TO PROCEED": "सुरक्षित — आगे बढ़ सकते हैं",
    "PROCEED WITH CAUTION": "सावधानीपूर्वक आगे बढ़ें",
    "Caution advised": "सावधानी बरतने की सलाह",
    "caution advised": "सावधानी बरतने की सलाह",
    "HIGH RISK — STAY ASHORE": "उच्च जोखिम — किनारे पर ही रहें",
    "High Risk": "उच्च जोखिम",
    "Moderate Risk": "मध्यम जोखिम",
    "Low Risk": "कम जोखिम",
    "LOW Risk": "कम जोखिम",
    "MODERATE Risk": "मध्यम जोखिम",
    "HIGH Risk": "उच्च जोखिम",
    "Calm seas": "शांत समुद्र",
    "Rough seas": "अशांत समुद्र",
    "Moderate seas": "मध्यम समुद्र",
    "favorable pelagic aggregation": "अनुकूल पेलाजिक मछली एकत्रीकरण",
    "pelagic aggregation": "पेलाजिक मछली एकत्रीकरण",
    
    # Units & Metrics
    "Waves:": "लहरें:",
    "Wind:": "हवा:",
    "SST:": "समुद्री सतह तापमान:",
    "Tide:": "ज्वार:",
    "Condition:": "स्थिति:",
    "sheltered waters": "संरक्षित जल क्षेत्र",
    "calmer sea": "शांत समुद्र",
    "km/h": "किमी/घंटा",
    "m": "मीटर",
    "nm": "नॉटिकल मील",
    "South-East": "दक्षिण-पूर्व",
    "South-West": "दक्षिण-पश्चिम",
    "North-East": "उत्तर-पूर्व",
    "North-West": "उत्तर-पश्चिम",
    
    # Locations
    "Mumbai (Sassoon Dock)": "मुंबई (सैसून डॉक)",
    "Mumbai Offshore Zone": "मुंबई अपतटीय क्षेत्र",
    "Alibaug Outer Bay": "अलीबाग आउटर बे",
    "Alibaug": "अलीबाग",
    "Jaigad Harbor": "जयगढ़ बंदरगाह",
    "Jaigad": "जयगढ़",
    "Chennai Nearshore": "चेन्नई तटवर्ती",
    "Chennai": "चेन्नई",
    "Kochi": "कोच्चि",
    "Goa": "गोवा",
    "Ratnagiri": "रत्नागिरी",
}

DICTIONARY_MR = {
    # Headers & Labels
    "Weather at Your Current Location": "तुमच्या सध्याच्या स्थानावरील हवामान",
    "Weather at current location": "सध्याच्या स्थानावरील हवामान",
    "Recommended Coastal Alternatives to": "साठी शिफारस केलेले सागरी पर्याय",
    "Recommended Coastal Alternatives": "पर्यायी सागरी ठिकाणे",
    "Active Fishing Area (PFZ)": "सक्रिय मासेमारी क्षेत्र (PFZ)",
    "Active Fishing Area": "सक्रिय मासेमारी क्षेत्र",
    "Potential Fishing Zone (PFZ)": "संभाव्य मासेमारी क्षेत्र (PFZ)",
    "Potential Fishing Zone": "संभाव्य मासेमारी क्षेत्र",
    "Coastal Alternatives": "पर्यायी सागरी बंदरे",
    "Fishing Advisory": "मासेमारी सल्ला",
    "Safety Advisory": "सुरक्षा सल्ला",
    
    # Status & Risks
    "Favorable for operations": "कामकाजासाठी अनुकूल व सुरक्षित",
    "favorable for operations": "कामकाजासाठी अनुकूल व सुरक्षित",
    "Safe to proceed": "पुढे जाण्यास सुरक्षित",
    "SAFE TO PROCEED": "सुरक्षित — प्रवासास अनुकूल",
    "PROCEED WITH CAUTION": "सावधगिरी बाळगा",
    "Caution advised": "दक्षता व सावधगिरी बाळगा",
    "caution advised": "दक्षता व सावधगिरी बाळगा",
    "HIGH RISK — STAY ASHORE": "उच्च धोका — समुद्रात जाऊ नये",
    "High Risk": "उच्च धोका",
    "Moderate Risk": "मध्यम धोका",
    "Low Risk": "कमी धोका",
    "LOW Risk": "कमी धोका",
    "MODERATE Risk": "मध्यम धोका",
    "HIGH Risk": "उच्च धोका",
    "Calm seas": "शांत समुद्र",
    "Rough seas": "खवळलेला समुद्र",
    "Moderate seas": "मध्यम समुद्र",
    "favorable pelagic aggregation": "अनुकूल पेलेजिक माशांचे एकत्रीकरण",
    "pelagic aggregation": "पेलेजिक माशांचे एकत्रीकरण",
    
    # Units & Metrics
    "Waves:": "लाटा:",
    "Wind:": "वारा:",
    "SST:": "समुद्राचे तापमान:",
    "Tide:": "भरती-ओहोटी:",
    "Condition:": "स्थिती:",
    "sheltered waters": "शांत व सुरक्षित सागरी बंदर",
    "calmer sea": "शांत समुद्र",
    "km/h": "किमी/तास",
    "m": "मीटर",
    "nm": "सागरी मैल",
    "South-East": "दक्षिण-पूर्व",
    "South-West": "दक्षिण-पश्चिम",
    "North-East": "उत्तर-पूर्व",
    "North-West": "उत्तर-पश्चिम",
    
    # Locations
    "Mumbai (Sassoon Dock)": "मुंबई (ससून डॉक)",
    "Mumbai Offshore Zone": "मुंबई ऑफशोर झोन",
    "Alibaug Outer Bay": "अलिबाग आऊटर बे",
    "Alibaug": "अलिबाग",
    "Jaigad Harbor": "जयगड बंदर",
    "Jaigad": "जयगड",
    "Chennai Nearshore": "चेन्नई नजीकचा समुद्र",
    "Chennai": "चेन्नई",
    "Kochi": "कोची",
    "Goa": "गोवा",
    "Ratnagiri": "रत्नागिरी",
}


def _split_into_chunks(text: str, max_chars: int = 380) -> list[str]:
    """Split multi-line text into chunks under character limit for free translation APIs."""
    if len(text) <= max_chars and "\n" not in text:
        return [text]
    lines = text.split("\n")
    chunks = []
    for l in lines:
        if len(l) <= max_chars:
            chunks.append(l)
        else:
            # Sub-split long line by punctuation or spaces
            parts = re.split(r"(?<=[.!?•;])\s+", l)
            buf = ""
            for p in parts:
                if len(buf) + len(p) + 1 <= max_chars:
                    buf = f"{buf} {p}".strip() if buf else p
                else:
                    if buf:
                        chunks.append(buf)
                    buf = p
            if buf:
                chunks.append(buf)
    return chunks


async def _translate_via_mymemory_pkg(text: str, target_lang: str, source_lang: str = "auto") -> str | None:
    """Translate using deep_translator MyMemoryTranslator with chunking."""
    try:
        from deep_translator import MyMemoryTranslator

        if source_lang in ("en", "english", "auto", ""):
            src = "hi-IN" if re.search(r"[\u0900-\u097F]", text) else "en-GB"
        else:
            src = "hi-IN" if source_lang in ("hi", "hindi") else "mr-IN"
        tgt = "hi-IN" if target_lang in ("hi", "hindi") else ("mr-IN" if target_lang in ("mr", "marathi") else "en-GB")
        
        loop = asyncio.get_running_loop()
        translator = MyMemoryTranslator(source=src, target=tgt)
        chunks = _split_into_chunks(text, max_chars=380)
        translated_chunks = []
        for ch in chunks:
            if not ch.strip():
                translated_chunks.append("")
                continue
            res = await loop.run_in_executor(None, lambda c=ch: translator.translate(c))
            if not res or "MYMEMORY WARNING" in res or "QUERY LENGTH LIMIT" in res:
                return None
            translated_chunks.append(res.strip())
        return "\n".join(translated_chunks)
    except Exception as exc:
        logger.debug("MyMemory package translation error: %s", exc)
    return None


async def _translate_via_mymemory_api(text: str, target_lang: str, source_lang: str = "auto") -> str | None:
    """Translate using direct MyMemory HTTP API with chunking."""
    try:
        if source_lang in ("en", "english", "auto", ""):
            src = "hi" if re.search(r"[\u0900-\u097F]", text) else "en"
        else:
            src = "hi" if source_lang in ("hi", "hindi") else "mr"
        tgt = "hi" if target_lang in ("hi", "hindi") else ("mr" if target_lang in ("mr", "marathi") else "en")

        chunks = _split_into_chunks(text, max_chars=380)
        translated_chunks = []
        async with httpx.AsyncClient(timeout=4.5) as client:
            for ch in chunks:
                if not ch.strip():
                    translated_chunks.append("")
                    continue
                url = f"https://api.mymemory.translated.net/get?q={urllib.parse.quote(ch)}&langpair={src}|{tgt}"
                resp = await client.get(url, headers={"User-Agent": "ORCA-Marine-Platform/1.0"})
                if resp.status_code != 200:
                    return None
                data = resp.json()
                translated = data.get("responseData", {}).get("translatedText")
                if not translated or "MYMEMORY WARNING" in translated or "QUERY LENGTH LIMIT" in translated:
                    return None
                translated_chunks.append(translated.strip())
        return "\n".join(translated_chunks)
    except Exception as exc:
        logger.debug("MyMemory HTTP API translation error: %s", exc)
    return None


async def _translate_via_web(text: str, target_lang: str, source_lang: str = "auto") -> str | None:
    """Translate using web client endpoint if available."""
    try:
        tl = "hi" if target_lang in ("hi", "hindi") else ("mr" if target_lang in ("mr", "marathi") else "en")
        sl = "auto" if source_lang in ("auto", "") else ("hi" if source_lang in ("hi", "hindi") else ("mr" if source_lang in ("mr", "marathi") else "en"))
        
        url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={sl}&tl={tl}&dt=t&q={urllib.parse.quote(text)}"
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0 and data[0]:
                    segments = [seg[0] for seg in data[0] if seg and seg[0]]
                    translated = "".join(segments).strip()
                    if translated:
                        return translated
    except Exception as exc:
        logger.debug("Web translation error: %s", exc)
    return None


async def _translate_via_llm(text: str, target_lang: str) -> str | None:
    """Fallback translation using configured LLM provider."""
    try:
        llm = get_llm_provider()
        if not llm.is_available():
            return None

        lang_name = "Hindi" if target_lang in ("hi", "hindi") else ("Marathi" if target_lang in ("mr", "marathi") else "English")
        prompt = f"""You are an expert coastal marine translator.
Translate this marine advisory message to {lang_name}.
Preserve markdown asterisks (**bold**) and bullet formatting (•).
Respond ONLY with the translated {lang_name} text, no explanations or quotes:

{text}"""
        
        res = await asyncio.wait_for(llm.generate(prompt, max_tokens=350), timeout=3.0)
        cleaned = res.strip().strip('"').strip("'")
        for pfx in ["Translation:", "अनुवाद:", "भाषांतर:", "सलाह:"]:
            if cleaned.startswith(pfx):
                cleaned = cleaned[len(pfx):].strip()
        return cleaned if cleaned else None
    except Exception as exc:
        logger.debug("LLM translation error: %s", exc)
    return None


def _translate_offline_dictionary(text: str, target_lang: str) -> str:
    """Deterministic marine vocabulary and regex substitution engine."""
    translated = text
    dict_map = DICTIONARY_HI if target_lang in ("hi", "hindi") else DICTIONARY_MR
    
    # Replace dictionary phrases (sorted by length descending for greedy matching)
    for en_phrase in sorted(dict_map.keys(), key=len, reverse=True):
        if en_phrase in translated:
            translated = translated.replace(en_phrase, dict_map[en_phrase])

    if target_lang in ("hi", "hindi"):
        translated = re.sub(r"Waves:\s*\*\*([0-9.]+\s*m)\*\*", r"लहरें: **\1**", translated)
        translated = re.sub(r"Wind:\s*\*\*([0-9.]+\s*km/h)\*\*", r"हवा: **\1**", translated)
        translated = re.sub(r"SW\b", "दक्षिण-पश्चिम", translated)
        translated = re.sub(r"NW\b", "उत्तर-पश्चिम", translated)
        translated = re.sub(r"NE\b", "उत्तर-पूर्व", translated)
        translated = re.sub(r"SE\b", "दक्षिण-पूर्व", translated)
    elif target_lang in ("mr", "marathi"):
        translated = re.sub(r"Waves:\s*\*\*([0-9.]+\s*m)\*\*", r"लाटा: **\1**", translated)
        translated = re.sub(r"Wind:\s*\*\*([0-9.]+\s*km/h)\*\*", r"वारा: **\1**", translated)
        translated = re.sub(r"SW\b", "नैऋत्य (SW)", translated)
        translated = re.sub(r"NW\b", "वायव्य (NW)", translated)
        translated = re.sub(r"NE\b", "ईशान्य (NE)", translated)
        translated = re.sub(r"SE\b", "आग्नेय (SE)", translated)

    return translated


async def translate_text(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate text to target language (en, hi, mr) using multi-tier engine."""
    if not text or not text.strip():
        return ""

    target_lang = target_lang.lower().strip()
    source_lang = source_lang.lower().strip()

    # Fast return if already target language and source language match
    is_devanagari = bool(re.search(r"[\u0900-\u097F]", text))
    if target_lang in ("en", "english") and (source_lang in ("en", "english") or not is_devanagari):
        return text

    # Tier 1: MyMemory via deep-translator package
    pkg_res = await _translate_via_mymemory_pkg(text, target_lang, source_lang)
    if pkg_res:
        return pkg_res

    # Tier 2: MyMemory direct HTTP API
    api_res = await _translate_via_mymemory_api(text, target_lang, source_lang)
    if api_res:
        return api_res

    # Tier 3: Google Web Translation
    web_result = await _translate_via_web(text, target_lang, source_lang)
    if web_result:
        return web_result

    # Tier 4: LLM Translation
    llm_result = await _translate_via_llm(text, target_lang)
    if llm_result:
        return llm_result

    # Tier 5: Deterministic Offline Dictionary & Patterns
    if target_lang in ("hi", "hindi", "mr", "marathi"):
        return _translate_offline_dictionary(text, target_lang)
    elif target_lang in ("en", "english"):
        # Reverse translation for Hindi / Marathi to English
        translated = text
        for d in [DICTIONARY_HI, DICTIONARY_MR]:
            for en_k, local_v in sorted(d.items(), key=lambda x: len(x[1]), reverse=True):
                if local_v in translated:
                    translated = translated.replace(local_v, en_k)
        translated = re.sub(r"लहरें:\s*\*\*([0-9.]+\s*m)\*\*", r"Waves: **\1**", translated)
        translated = re.sub(r"लाटा:\s*\*\*([0-9.]+\s*m)\*\*", r"Waves: **\1**", translated)
        translated = re.sub(r"हवा:\s*\*\*([0-9.]+\s*km/h)\*\*", r"Wind: **\1**", translated)
        translated = re.sub(r"वारा:\s*\*\*([0-9.]+\s*km/h)\*\*", r"Wind: **\1**", translated)
        return translated

    return text
