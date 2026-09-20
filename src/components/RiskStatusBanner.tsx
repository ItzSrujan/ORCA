import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';
import type { RiskLevel } from '../types';

interface RiskStatusBannerProps {
  riskLevel: RiskLevel;
}

export const RiskStatusBanner: React.FC<RiskStatusBannerProps> = ({ riskLevel }) => {
  const { t } = useTranslation();

  const config = {
    SAFE: {
      title: t('risk.safe'),
      description: t('risk.safeDesc'),
      icon: ShieldCheck,
      badgeClass: 'bg-emerald-700 text-white',
      containerClass: 'bg-emerald-50/90 border-emerald-300 text-emerald-950',
      iconClass: 'text-emerald-700',
      pulseClass: 'bg-emerald-500',
    },
    CAUTION: {
      title: t('risk.caution'),
      description: t('risk.cautionDesc'),
      icon: AlertTriangle,
      badgeClass: 'bg-amber-600 text-white',
      containerClass: 'bg-amber-50/90 border-amber-300 text-amber-950',
      iconClass: 'text-amber-700',
      pulseClass: 'bg-amber-500',
    },
    HIGH_RISK: {
      title: t('risk.highRisk'),
      description: t('risk.highRiskDesc'),
      icon: AlertOctagon,
      badgeClass: 'bg-red-700 text-white',
      containerClass: 'bg-red-50/90 border-red-300 text-red-950',
      iconClass: 'text-red-700',
      pulseClass: 'bg-red-500',
    },
    INSUFFICIENT_DATA: {
      title: t('risk.insufficientData'),
      description: t('risk.insufficientDesc'),
      icon: HelpCircle,
      badgeClass: 'bg-slate-600 text-white',
      containerClass: 'bg-slate-100 border-slate-300 text-slate-900',
      iconClass: 'text-slate-600',
      pulseClass: 'bg-slate-400',
    },
  }[riskLevel] || {
    title: t('risk.caution'),
    description: t('risk.cautionDesc'),
    icon: AlertTriangle,
    badgeClass: 'bg-amber-600 text-white',
    containerClass: 'bg-amber-50 border-amber-300 text-amber-950',
    iconClass: 'text-amber-700',
    pulseClass: 'bg-amber-500',
  };

  const Icon = config.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-2 rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${config.containerClass}`}
    >
      <div className="flex items-start sm:items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-white shadow-xs border border-black/5 flex items-center justify-center shrink-0">
          <Icon className={`w-7 h-7 ${config.iconClass}`} aria-hidden="true" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs sm:text-sm font-bold tracking-wide uppercase ${config.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full ${config.pulseClass} animate-pulse`} />
              {config.title}
            </span>
          </div>
          <p className="mt-1.5 text-xs sm:text-sm font-medium leading-relaxed opacity-90">
            {config.description}
          </p>
        </div>
      </div>
    </div>
  );
};
