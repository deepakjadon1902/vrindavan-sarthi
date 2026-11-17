import React from 'react';
import { Compass, Check, X, MapPin, SlidersHorizontal } from 'lucide-react';
import type { GeolocationStatus } from '@/hooks/useUserGeolocation';
import { BRAJ_LANDMARK_REGISTRY } from '@/lib/geoDiscovery';

export interface DiscoveryLocationBarProps {
  geoStatus: GeolocationStatus;
  onRequestLocation: () => void;
  onClearLocation: () => void;
  selectedLandmark: string;
  onSelectLandmark: (landmark: string) => void;
  acFilter: 'all' | 'ac' | 'non_ac';
  onSelectAcFilter: (val: 'all' | 'ac' | 'non_ac') => void;
  totalResultsCount: number;
  className?: string;
}

export const DiscoveryLocationBar: React.FC<DiscoveryLocationBarProps> = ({
  geoStatus,
  onRequestLocation,
  onClearLocation,
  selectedLandmark,
  onSelectLandmark,
  acFilter,
  onSelectAcFilter,
  totalResultsCount,
  className = '',
}) => {
  return (
    <div className={`w-full space-y-2.5 ${className}`}>
      {/* Row 1: Landmark & GPS Quick Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 w-full max-w-full">
        {/* GPS "Near Me" Action Button */}
        {geoStatus === 'granted' ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 text-emerald-900 border border-emerald-300/80 px-3 py-1 font-body text-xs font-bold shrink-0 shadow-xs">
            <Check size={13} className="text-emerald-700" />
            <span>Near Your Location</span>
            <button
              type="button"
              onClick={onClearLocation}
              className="ml-0.5 rounded-full p-0.5 text-emerald-700 hover:bg-emerald-200"
              aria-label="Clear location filter"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onRequestLocation}
            disabled={geoStatus === 'requesting'}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-body text-xs font-bold shrink-0 transition-all ${
              geoStatus === 'requesting'
                ? 'bg-amber-100 text-amber-800 animate-pulse'
                : 'bg-white text-slate-800 border border-neutral-300 hover:border-amber-700 hover:bg-amber-50/50 shadow-xs active:scale-95'
            }`}
          >
            <Compass
              size={13}
              className={geoStatus === 'requesting' ? 'animate-spin text-amber-700' : 'text-amber-700'}
            />
            <span>{geoStatus === 'requesting' ? 'Locating...' : 'Near Me (GPS)'}</span>
          </button>
        )}

        <div className="h-4 w-px bg-neutral-200 shrink-0 mx-0.5" />

        {/* All Areas Pill */}
        <button
          type="button"
          onClick={() => onSelectLandmark('')}
          className={`rounded-full px-3 py-1 font-body text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
            !selectedLandmark
              ? 'bg-slate-900 text-white font-bold shadow-xs'
              : 'bg-neutral-100/80 text-slate-700 hover:bg-neutral-200/70'
          }`}
        >
          All Braj Dham
        </button>

        {/* Primary Braj Landmark Quick Filters */}
        {BRAJ_LANDMARK_REGISTRY.map((landmark) => {
          const isSelected =
            selectedLandmark.toLowerCase() === landmark.id.toLowerCase() ||
            selectedLandmark.toLowerCase() === landmark.name.toLowerCase();
          return (
            <button
              key={landmark.id}
              type="button"
              onClick={() => onSelectLandmark(isSelected ? '' : landmark.id)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-body text-xs whitespace-nowrap transition-colors shrink-0 ${
                isSelected
                  ? 'bg-amber-800 text-white font-bold shadow-xs'
                  : 'bg-neutral-100/80 text-slate-700 hover:bg-neutral-200/70 font-medium'
              }`}
            >
              <MapPin size={11} className={isSelected ? 'text-amber-200' : 'text-slate-400'} />
              <span>{landmark.name}</span>
            </button>
          );
        })}
      </div>

      {/* Row 2: Secondary Quick Filters (AC / Non-AC & Count) */}
      <div className="flex items-center justify-between gap-3 text-xs font-body pt-1 border-t border-neutral-100">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider shrink-0 mr-1">
            Comfort:
          </span>
          <button
            type="button"
            onClick={() => onSelectAcFilter('all')}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              acFilter === 'all'
                ? 'bg-amber-100 text-amber-900 font-bold'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            All Room Types
          </button>
          <button
            type="button"
            onClick={() => onSelectAcFilter('ac')}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              acFilter === 'ac'
                ? 'bg-amber-100 text-amber-900 font-bold'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            AC Rooms
          </button>
          <button
            type="button"
            onClick={() => onSelectAcFilter('non_ac')}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              acFilter === 'non_ac'
                ? 'bg-amber-100 text-amber-900 font-bold'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            Non-AC / Budget
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-1 font-body text-xs font-semibold text-slate-500 shrink-0">
          <span>{totalResultsCount} verified stays available</span>
        </div>
      </div>
    </div>
  );
};

export default DiscoveryLocationBar;
