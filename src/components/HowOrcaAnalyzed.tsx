import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, CheckCircle2, ShieldCheck } from 'lucide-react';

export const HowOrcaAnalyzed: React.FC = () => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const steps = [
    t('howAnalyzed.stepWeather'),
    t('howAnalyzed.stepMarine'),
    t('howAnalyzed.stepTide'),
    t('howAnalyzed.stepAdvisory'),
    t('howAnalyzed.stepRisk'),
  ];

  return (
    <div className="bg-white border border-surface-300 rounded-2xl overflow-hidden shadow-2xs">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-marine-100 flex items-center justify-center text-marine-700">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-navy-900">
            {t('howAnalyzed.title')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-surface-500 font-medium">
          <span>{isExpanded ? 'Hide' : 'Show'}</span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-surface-200 bg-surface-50/50 animate-in fade-in duration-150">
          <div className="space-y-2 pt-2">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 text-xs sm:text-sm text-navy-800 font-medium"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
