import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Info,
  ShieldAlert,
  Send,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Sparkles,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { apiService } from '../services/api';
import type { LocationAssessment, AskOrcaResponse } from '../types';

interface RecommendationCardProps {
  recommendation: string;
  reason: string;
  isMissingData?: boolean;
  currentLocation?: LocationAssessment;
}

const parseBoldMarkdown = (text: string) => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-bold text-navy-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const renderFormattedAnswer = (rawText: string) => {
  if (!rawText) return null;

  // Normalize inline bullets like ")... • **" or "... • **" into distinct lines
  const normalized = rawText
    .replace(/([.!?\)])\s*•\s*/g, '$1\n• ')
    .replace(/([.!?\)])\s*-\s*/g, '$1\n- ');

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, idx) => {
        const isBullet = line.startsWith('•') || line.startsWith('-');
        const cleanText = isBullet ? line.replace(/^[•\-]\s*/, '') : line;

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 sm:pl-2 text-navy-900">
              <span className="text-marine-600 font-bold shrink-0 mt-0.5">•</span>
              <span className="flex-1">{parseBoldMarkdown(cleanText)}</span>
            </div>
          );
        }

        return (
          <div key={idx} className="font-medium text-navy-950 pb-0.5">
            {parseBoldMarkdown(cleanText)}
          </div>
        );
      })}
    </div>
  );
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  reason,
  isMissingData = false,
  currentLocation,
}) => {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [activePrompt, setActivePrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AskOrcaResponse | null>(null);
  const [displayedAnswer, setDisplayedAnswer] = useState<string>('');
  const [answerLang, setAnswerLang] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  const examples = [
    t('ask.example1'),
    t('ask.example4'),
    t('ask.example2'),
    t('ask.example3'),
  ];

  const handleAsk = async (textToAsk?: string) => {
    const q = (textToAsk || query).trim();
    if (!q || isLoading || !currentLocation) return;

    setIsLoading(true);
    setActivePrompt(q);
    setQuery('');

    const doQuery = async (lat?: number, lon?: number, locName?: string) => {
      try {
        const res = await apiService.askOrca({
          query: q,
          latitude: lat ?? currentLocation.coordinates.latitude,
          longitude: lon ?? currentLocation.coordinates.longitude,
          locationName: locName ?? currentLocation.name,
          language: currentLang,
        });
        setResponse(res);
        setDisplayedAnswer(res.answer);
        setAnswerLang(currentLang);
      } catch (err) {
        console.error('Query failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    // If query asks for current location, attempt live browser GPS coordinates
    const isCurrentLocQuery = /current\s+location|my\s+location|where\s+i\s+am|right\s+here/i.test(q);
    if (isCurrentLocQuery && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          doQuery(pos.coords.latitude, pos.coords.longitude, currentLocation.name || 'Your Current Location');
        },
        () => {
          // GPS unavailable or denied, use current location coordinates with label
          doQuery(currentLocation.coordinates.latitude, currentLocation.coordinates.longitude, currentLocation.name);
        },
        { timeout: 4000, enableHighAccuracy: true }
      );
    } else {
      doQuery(currentLocation.coordinates.latitude, currentLocation.coordinates.longitude, currentLocation.name);
    }
  };

  const translateAnswerTo = async (targetLang: string) => {
    if (!response || !response.answer || isTranslating) return;
    if (targetLang === answerLang) return;

    // If reverting to English and original response was English, restore immediately
    if (targetLang === 'en' && /^[\x00-\x7F\s•—–°’"“”()[\],.:;0-9\w-]+$/.test(response.answer)) {
      setDisplayedAnswer(response.answer);
      setAnswerLang('en');
      return;
    }

    setIsTranslating(true);
    try {
      const translated = await apiService.translateText(response.answer, targetLang, 'auto');
      if (translated) {
        setDisplayedAnswer(translated);
        setAnswerLang(targetLang);
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Auto-translate answer when language switches in top bar
  useEffect(() => {
    if (response && answerLang !== currentLang) {
      translateAnswerTo(currentLang);
    }
  }, [currentLang]);

  return (
    <div className="bg-white border border-surface-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-marine-100 flex items-center justify-center text-marine-700">
            <Info className="w-4 h-4" />
          </div>
          <h2 className="text-2xs font-bold uppercase tracking-wider text-navy-700">
            {t('recommendation.title')}
          </h2>
        </div>

        {response && (
          <button
            type="button"
            onClick={() => {
              setResponse(null);
              setDisplayedAnswer('');
              setQuery('');
              setActivePrompt('');
            }}
            className="text-2xs text-surface-500 hover:text-navy-900 flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md hover:bg-surface-100 font-medium"
            title="Show default recommendation"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Show Overview</span>
          </button>
        )}
      </div>

      {/* Main Content Area: Default Recommendation OR Loading OR AI Response */}
      {isLoading ? (
        <div className="bg-marine-50/80 border border-marine-200 rounded-xl p-3.5 sm:p-4 space-y-1.5 animate-pulse">
          <div className="flex items-center gap-2 text-marine-800 font-semibold text-xs sm:text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-marine-600 shrink-0" />
            <span>Analyzing marine telemetry for <strong className="text-navy-950 font-bold">"{activePrompt}"</strong>...</span>
          </div>
          <p className="text-2xs text-surface-500 pl-6">
            Evaluating waves, wind velocity, tidal currents, and spatial map data...
          </p>
        </div>
      ) : !response ? (
        <div className="bg-surface-100 border border-surface-200 rounded-xl p-3.5 sm:p-4 space-y-2.5">
          <div className="text-sm sm:text-base text-navy-950 leading-relaxed font-normal">
            {renderFormattedAnswer(recommendation.replace(/^["']|["']$/g, ''))}
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-surface-200">
            <span className="text-2xs font-bold uppercase tracking-wider text-surface-500 block mb-0.5">
              {t('recommendation.reasonTitle')}:
            </span>
            <p className="text-xs sm:text-sm text-navy-800 leading-relaxed font-normal">
              {isMissingData
                ? 'Some important information is currently unavailable. Use caution and verify conditions locally before departure.'
                : reason}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-marine-50/70 border border-marine-200 rounded-xl p-3.5 space-y-2.5 animate-in fade-in duration-200">
          {/* Prompt banner */}
          {(activePrompt || response.query) && (
            <div className="text-2xs font-semibold text-marine-800 bg-white/90 border border-marine-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
              <span className="font-bold text-marine-900">Q:</span>
              <span className="text-navy-900 truncate">"{activePrompt || response.query}"</span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold uppercase tracking-wider text-marine-800">
                {t('ask.responseTitle')}
              </span>
              {response.riskLevel && (
                <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full bg-white border border-marine-300 text-navy-800">
                  {response.riskLevel === 'SAFE' ? (
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                  )}
                  {response.riskLevel}
                </span>
              )}
              {response.isLlmActive ? (
                <span
                  className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800"
                  title="Live LLM generated"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  {response.llmModel || 'GLM-5.3'}
                </span>
              ) : (
                <span
                  className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-full bg-surface-100 border border-surface-300 text-navy-700"
                  title="ORCA Multi-Agent Telemetry Synthesis"
                >
                  <Info className="w-3 h-3 text-marine-600" />
                  Telemetry Synthesizer
                </span>
              )}
            </div>

            {/* Translation Controls */}
            <div className="flex items-center gap-1 bg-white/90 border border-marine-200 rounded-lg p-0.5 shrink-0">
              <Globe className={`w-3 h-3 text-marine-600 ml-1 shrink-0 ${isTranslating ? 'animate-spin' : ''}`} />
              <button
                type="button"
                onClick={() => translateAnswerTo('en')}
                disabled={isTranslating}
                className={`px-1.5 py-0.5 text-2xs rounded font-medium transition-colors ${
                  answerLang === 'en'
                    ? 'bg-marine-600 text-white font-bold'
                    : 'text-navy-700 hover:bg-marine-100'
                }`}
                title="Translate to English"
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => translateAnswerTo('hi')}
                disabled={isTranslating}
                className={`px-1.5 py-0.5 text-2xs rounded font-medium transition-colors ${
                  answerLang === 'hi'
                    ? 'bg-marine-600 text-white font-bold'
                    : 'text-navy-700 hover:bg-marine-100'
                }`}
                title="Translate to Hindi"
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => translateAnswerTo('mr')}
                disabled={isTranslating}
                className={`px-1.5 py-0.5 text-2xs rounded font-medium transition-colors ${
                  answerLang === 'mr'
                    ? 'bg-marine-600 text-white font-bold'
                    : 'text-navy-700 hover:bg-marine-100'
                }`}
                title="Translate to Marathi"
              >
                मराठी
              </button>
            </div>
          </div>

          {response.errors &&
            response.errors.some(
              (e) => e.includes('402') || e.includes('credits depleted') || e.includes('Payment Required')
            ) && (
              <div className="bg-amber-50/90 border border-amber-300 rounded-lg p-2.5 text-2xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-snug">
                  <span className="font-bold block text-amber-950">
                    Hugging Face Inference Quota Notice ({response.llmModel || 'zai-org/GLM-5.3'})
                  </span>
                  <span className="text-amber-900 block">
                    Your monthly Hugging Face token credits are currently depleted (HTTP 402). Output is dynamically generated by ORCA's Multi-Agent Telemetry & Spatial Mapping Engine.
                  </span>
                </div>
              </div>
            )}

          <div className="text-xs sm:text-sm text-navy-950 font-medium leading-relaxed">
            {isTranslating ? (
              <span className="inline-flex items-center gap-1.5 text-surface-500 italic">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-marine-600" />
                Translating...
              </span>
            ) : (
              renderFormattedAnswer(displayedAnswer || response.answer)
            )}
          </div>

          {response.evidenceUsed && response.evidenceUsed.length > 0 && (
            <div className="pt-2 border-t border-marine-200/60">
              <span className="text-2xs font-bold uppercase tracking-wider text-marine-700 block mb-1">
                {t('ask.evidenceTitle')}:
              </span>
              <div className="flex flex-wrap gap-1">
                {response.evidenceUsed.map((ev, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-2xs bg-white text-marine-900 border border-marine-200 px-2 py-0.5 rounded"
                  >
                    <CheckCircle2 className="w-3 h-3 text-marine-600" />
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Integrated Prompt Box */}
      <div className="space-y-2 pt-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ask.placeholder')}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-surface-300 focus:outline-none focus:ring-2 focus:ring-marine-500 text-sm text-navy-900 bg-surface-50 placeholder:text-surface-400 min-w-0"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden xs:inline">{t('ask.send')}</span>
              </>
            )}
          </button>
        </form>

        {/* Example Chips */}
        <div>
          <span className="text-2xs font-bold uppercase tracking-wider text-surface-400 block mb-1.5">
            {t('ask.examplesTitle')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(ex)}
                className="text-2xs sm:text-xs text-navy-700 bg-surface-100 hover:bg-surface-200 border border-surface-200 rounded-lg px-2.5 py-1 text-left transition-colors"
              >
                "{ex}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Safety Disclaimer */}
      <div className="flex items-start gap-2 text-2xs text-surface-500 leading-normal pt-1 border-t border-surface-200">
        <ShieldAlert className="w-3.5 h-3.5 text-surface-400 shrink-0 mt-0.5" />
        <p>{t('recommendation.disclaimer')}</p>
      </div>
    </div>
  );
};
