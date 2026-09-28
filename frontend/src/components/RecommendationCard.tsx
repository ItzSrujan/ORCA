import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Send,
  Loader2,
  RotateCcw,
  X,
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
        <strong key={idx} className="font-semibold text-white">
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
    .replace(/([.!?]|\))\s*•\s*/g, '$1\n• ')
    .replace(/([.!?]|\))\s*-\s*/g, '$1\n- ');

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, idx) => {
        const isBullet = line.startsWith('•') || line.startsWith('-');
        const cleanText = isBullet ? line.replace(/^[•-]\s*/, '') : line;

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 sm:pl-2 text-slate-200">
              <span className="text-sky-400 font-bold shrink-0 mt-0.5">•</span>
              <span className="flex-1">{parseBoldMarkdown(cleanText)}</span>
            </div>
          );
        }

        return (
          <div key={idx} className="font-normal text-slate-100 pb-0.5">
            {parseBoldMarkdown(cleanText)}
          </div>
        );
      })}
    </div>
  );
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation: _recommendation,
  reason: _reason,
  isMissingData: _isMissingData = false,
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

  const [newTokenInput, setNewTokenInput] = useState('');
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [tokenFeedback, setTokenFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  const currentLang = i18n.resolvedLanguage || i18n.language || 'en';

  const examples = [
    t('ask.example1'),
    t('ask.example2'),
    t('ask.example3'),
    t('ask.example4'),
    t('ask.example5'),
    t('ask.example6'),
    t('ask.example7'),
    t('ask.example8'),
    t('ask.example9'),
    t('ask.example10'),
  ];

  const handleActivateToken = async () => {
    if (!newTokenInput.trim()) return;
    setIsSavingToken(true);
    setTokenFeedback(null);
    try {
      const res = await apiService.updateHfToken(newTokenInput.trim());
      if (res.valid) {
        setTokenFeedback({ success: true, msg: res.message || 'Token verified and activated.' });
        setTimeout(() => {
          handleAsk(activePrompt || 'Is it safe to go fishing today?');
        }, 1200);
      } else {
        setTokenFeedback({ success: false, msg: res.error || 'Token verification failed.' });
      }
    } catch (err: any) {
      setTokenFeedback({ success: false, msg: err?.message || 'Failed to update token.' });
    } finally {
      setIsSavingToken(false);
    }
  };

  const handleAsk = async (textToAsk?: string) => {
    const q = (textToAsk || query).trim();
    if (!q || isLoading || !currentLocation) return;

    setIsLoading(true);
    setActivePrompt(q);
    setQuery(q);

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

        // Verify if returned answer matches the active currentLang
        const hasDevanagari = /[\u0900-\u097F]/.test(res.answer);
        const shouldBeDevanagari = currentLang === 'hi' || currentLang === 'mr';

        if (shouldBeDevanagari && !hasDevanagari) {
          setDisplayedAnswer(res.answer);
          setAnswerLang('en');
          translateAnswerTo(currentLang, res.answer);
        } else if (!shouldBeDevanagari && hasDevanagari) {
          setDisplayedAnswer(res.answer);
          setAnswerLang('hi');
          translateAnswerTo(currentLang, res.answer);
        } else {
          setDisplayedAnswer(res.answer);
          setAnswerLang(currentLang);
        }
      } catch (err: any) {
        setResponse({
          query: q,
          answer: t('ask.error', 'Unable to reach ORCA decision engine.'),
          errors: [err?.message || 'Network error'],
          evidenceUsed: [],
        });
        setDisplayedAnswer(t('ask.error', 'Unable to reach ORCA decision engine.'));
      } finally {
        setIsLoading(false);
      }
    };

    doQuery();
  };

  const translateAnswerTo = async (targetLang: string, textToTranslate?: string) => {
    const rawAnswer = textToTranslate || (response ? response.answer : '');
    if (!rawAnswer) return;

    if (targetLang === 'en' && !/[\u0900-\u097F]/.test(rawAnswer)) {
      setDisplayedAnswer(rawAnswer);
      setAnswerLang('en');
      return;
    }

    setIsTranslating(true);
    try {
      const res = await apiService.translateText(rawAnswer, targetLang);
      if (res) {
        setDisplayedAnswer(res);
        setAnswerLang(targetLang);
      }
    } catch (err) {
      console.warn('Failed to translate answer to', targetLang, err);
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (response) {
      const hasDevanagari = /[\u0900-\u097F]/.test(displayedAnswer || response.answer);
      const isTargetDevanagari = currentLang === 'hi' || currentLang === 'mr';

      if (answerLang !== currentLang || (isTargetDevanagari && !hasDevanagari) || (!isTargetDevanagari && hasDevanagari)) {
        translateAnswerTo(currentLang);
      }
    }
  }, [currentLang]);

  return (
    <div className="bg-[#0A111E] rounded-xl p-4 sm:p-5 border border-slate-800 space-y-3.5 transition-colors">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
          <h2 className="text-2xs font-mono font-bold uppercase tracking-wider text-slate-300">
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
            className="text-2xs font-mono text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
            title="Reset to default overview"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{t('ask.showOverview', 'Reset')}</span>
          </button>
        )}
      </div>

      {/* Main Content Area: Loading OR AI Response */}
      {isLoading ? (
        <div className="bg-[#060B14] border border-slate-800 rounded-lg p-3.5 space-y-1.5 font-mono">
          <div className="flex items-center gap-2 text-sky-300 text-xs sm:text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400 shrink-0" />
            <span>Analyzing marine telemetry for <strong className="text-white">"{activePrompt}"</strong>...</span>
          </div>
          <p className="text-2xs text-slate-500 pl-5">
            Evaluating wind velocity, wave dynamics, tidal flows, and port safety...
          </p>
        </div>
      ) : response ? (
        <div className="bg-[#060B14] border border-slate-800 rounded-lg p-3.5 space-y-3">
          {/* Query label */}
          {(activePrompt || response.query) && (
            <div className="text-2xs font-mono text-slate-300 bg-[#0A111E] border border-slate-800 px-2.5 py-1 rounded flex items-center gap-2">
              <span className="text-sky-400 font-bold">QUERY:</span>
              <span className="text-slate-200 truncate">"{activePrompt || response.query}"</span>
            </div>
          )}

          {/* Response metadata bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-2xs font-mono font-bold uppercase tracking-wider text-slate-400">
                {t('ask.responseTitle')}
              </span>
              {response.riskLevel && (
                <span className={`text-2xs font-mono font-bold px-2 py-0.5 rounded border ${
                  response.riskLevel === 'SAFE'
                    ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-300'
                    : 'bg-amber-950/80 border-amber-600/60 text-amber-300'
                }`}>
                  {response.riskLevel}
                </span>
              )}
              <span className="text-2xs font-mono px-2 py-0.5 rounded bg-[#0A111E] border border-slate-800 text-slate-300">
                {response.isLlmActive ? (response.llmModel || 'HF Model') : 'Multi-Agent Telemetry'}
              </span>
              {isTranslating && (
                <span className="text-2xs font-mono text-sky-400 inline-flex items-center gap-1 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Translating...</span>
                </span>
              )}
            </div>
          </div>

          {/* Token Authentication Notice */}
          {response.errors &&
            response.errors.some(
              (e) => e.includes('401') || e.includes('expired') || e.includes('Unauthorized')
            ) && (
              <div className="bg-amber-950/40 border border-amber-700/60 rounded p-2.5 text-xs text-amber-200 space-y-2">
                <div>
                  <span className="font-semibold block text-amber-100">
                    Hugging Face Authentication Notice ({response.llmModel || 'HF Model'})
                  </span>
                  <span className="text-2xs text-amber-300 block mt-0.5">
                    Hugging Face token is expired or unauthorized. Output is synthesized via ORCA's live multi-agent engine.
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    placeholder="Enter active HF Token (hf_...)"
                    value={newTokenInput}
                    onChange={(e) => setNewTokenInput(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded border border-amber-700/70 bg-[#080D18] text-white focus:outline-none focus:border-amber-500 font-mono flex-1 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleActivateToken}
                    disabled={isSavingToken || !newTokenInput.trim()}
                    className="px-3 py-1 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white transition-colors cursor-pointer"
                  >
                    {isSavingToken ? 'Verifying...' : 'Update Token'}
                  </button>
                </div>
                {tokenFeedback && (
                  <div className={`text-2xs font-mono ${tokenFeedback.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {tokenFeedback.msg}
                  </div>
                )}
              </div>
            )}

          {/* Formatted Answer */}
          <div className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans">
            {isTranslating ? (
              <span className="inline-flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                Translating answer...
              </span>
            ) : (
              renderFormattedAnswer(displayedAnswer || response.answer)
            )}
          </div>

          {/* Evidence tags */}
          {response.evidenceUsed && response.evidenceUsed.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-2xs font-mono uppercase tracking-wider text-slate-400 block mb-1">
                {t('ask.evidenceTitle')}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {response.evidenceUsed.map((ev, i) => (
                  <span
                    key={i}
                    className="text-2xs font-mono bg-[#0A111E] text-slate-300 border border-slate-800 px-2 py-0.5 rounded"
                  >
                    {ev}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Integrated Prompt Box */}
      <div className="space-y-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('ask.placeholder')}
              className="w-full pl-3.5 pr-8 py-2.5 rounded-lg border border-slate-700/80 bg-[#060B14] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 text-xs sm:text-sm transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Clear input"
                aria-label="Clear input"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{t('ask.send')}</span>
              </>
            )}
          </button>
        </form>

        {/* Operational Query Chips */}
        <div>
          <span className="text-2xs font-mono uppercase tracking-wider text-slate-400 block mb-1.5 font-medium">
            {t('ask.examplesTitle')}:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {examples.map((ex, idx) => {
              const isSelected = query.trim() === ex.trim();
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(ex);
                    handleAsk(ex);
                  }}
                  className={`text-2xs sm:text-xs rounded-md px-3 py-2 text-left transition-all flex items-baseline gap-2 cursor-pointer font-sans ${
                    isSelected
                      ? 'bg-sky-950/70 border border-sky-600/60 text-sky-200'
                      : 'text-slate-300 bg-[#070D18] hover:bg-[#0E1726] border border-slate-800/90 hover:border-slate-700/80 hover:text-white'
                  }`}
                >
                  <span className="text-sky-400 font-mono text-xs select-none shrink-0">›</span>
                  <span className="line-clamp-1">{ex}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Safety Disclaimer */}
      <div className="text-3xs sm:text-2xs font-mono text-slate-500 leading-normal pt-2 border-t border-slate-800/80">
        {t('recommendation.disclaimer')}
      </div>
    </div>
  );
};
