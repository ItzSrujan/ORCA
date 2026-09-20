import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wind,
  Waves,
  Navigation2,
  Thermometer,
  Clock,
  Fish,
} from 'lucide-react';
import type { LocationConditions } from '../types';

interface ConditionsGridProps {
  conditions: LocationConditions;
}

export const ConditionsGrid: React.FC<ConditionsGridProps> = ({ conditions }) => {
  const { t } = useTranslation();

  const tideLabel =
    conditions.tideStatus === 'Rising'
      ? t('conditions.tideRising')
      : conditions.tideStatus === 'Falling'
      ? t('conditions.tideFalling')
      : conditions.tideStatus && conditions.tideStatus !== 'Unavailable'
      ? conditions.tideStatus
      : t('conditions.tideUnavailable');

  const advisoryLabel = conditions.fishingAdvisoryAvailable
    ? t('conditions.advisoryAvailable')
    : t('conditions.advisoryUnavailable');

  const cards = [
    {
      id: 'wind',
      icon: Wind,
      title: t('conditions.wind'),
      value: `${conditions.windSpeedKmH} km/h`,
      status: conditions.windStatus || (conditions.windSpeedKmH > 25 ? 'High wind' : 'Moderate'),
      detail: conditions.windDirection ? `Dir: ${conditions.windDirection}` : undefined,
      color: conditions.windSpeedKmH > 25 ? 'text-amber-600' : 'text-navy-700',
    },
    {
      id: 'waves',
      icon: Waves,
      title: t('conditions.waves'),
      value: `${conditions.waveHeightM} m`,
      status: conditions.waveStatus || (conditions.waveHeightM > 1.5 ? 'Rough seas' : 'Moderate'),
      detail: conditions.wavePeriodS ? `${conditions.wavePeriodS}s period` : undefined,
      color: conditions.waveHeightM > 1.5 ? 'text-amber-600' : 'text-marine-600',
    },
    {
      id: 'current',
      icon: Navigation2,
      title: t('conditions.current'),
      value: `${conditions.currentSpeedMs} m/s`,
      status: conditions.currentStatus || 'Normal flow',
      detail: undefined,
      color: conditions.currentSpeedMs > 1.0 ? 'text-amber-600' : 'text-teal-600',
    },
    {
      id: 'seaTemp',
      icon: Thermometer,
      title: t('conditions.seaTemp'),
      value: `${conditions.seaTemperatureC}°C`,
      status: t('conditions.statusWarm'),
      detail: undefined,
      color: 'text-amber-700',
    },
    {
      id: 'tide',
      icon: Clock,
      title: t('conditions.tide'),
      value: tideLabel,
      status: conditions.tideNote || (conditions.tideStatus === 'Unavailable' ? 'Telemetry missing' : 'Normal cycle'),
      detail: undefined,
      color: conditions.tideStatus === 'Unavailable' ? 'text-surface-400' : 'text-indigo-600',
    },
    {
      id: 'advisory',
      icon: Fish,
      title: t('conditions.fishingAdvisory'),
      value: advisoryLabel,
      status: conditions.fishingAdvisoryZone || (conditions.fishingAdvisoryAvailable ? 'Zone Active' : 'No Advisory'),
      detail: undefined,
      color: conditions.fishingAdvisoryAvailable ? 'text-emerald-700' : 'text-surface-400',
    },
  ];

  return (
    <div className="space-y-2.5">
      <h2 className="text-2xs font-bold uppercase tracking-wider text-navy-600 px-1">
        {t('conditions.title')}
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.id}
              className="bg-white border border-surface-300 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-surface-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xs font-bold uppercase tracking-wider text-surface-500">
                  {c.title}
                </span>
                <div className={`p-1.5 rounded-lg bg-surface-100 ${c.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-2">
                <div className="text-lg sm:text-xl font-bold text-navy-950 tracking-tight leading-none">
                  {c.value}
                </div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-navy-700 truncate">
                    {c.status}
                  </span>
                  {c.detail && (
                    <span className="text-2xs text-surface-400 shrink-0 font-mono hidden xs:inline">
                      {c.detail}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
