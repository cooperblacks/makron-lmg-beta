import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { VerifiedType } from '../types';

interface VerifiedBadgeProps {
  type?: VerifiedType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ type, size = 'sm', className = '' }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!type) return null;

  const configMap: Record<
    Exclude<VerifiedType, null | undefined>,
    { label: string; bg: string; text: string; ring: string }
  > = {
    paid: {
      label: 'Premium member',
      bg: 'bg-gradient-to-r from-amber-400 to-yellow-500',
      text: 'text-amber-950',
      ring: 'ring-amber-400/40',
    },
    celeb: {
      label: 'Verified member',
      bg: 'bg-gradient-to-r from-sky-400 to-blue-500',
      text: 'text-white',
      ring: 'ring-sky-400/40',
    },
    dev: {
      label: 'Verified developer',
      bg: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      text: 'text-white',
      ring: 'ring-purple-400/40',
    },
    founder: {
      label: "This user is Makron's founder",
      bg: 'bg-gradient-to-r from-emerald-500 to-teal-600',
      text: 'text-white',
      ring: 'ring-emerald-400/40',
    },
  };

  const current = configMap[type];
  if (!current) return null;

  const sizeClasses =
    size === 'lg'
      ? 'w-4 h-4 text-[10px]'
      : size === 'md'
      ? 'w-3.5 h-3.5 text-[9px]'
      : 'w-3 h-3 text-[8px]';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        title={current.label}
        className={`${sizeClasses} ${current.bg} ${current.text} rounded-full flex items-center justify-center font-black shadow-xs ring-1 ${current.ring} cursor-help select-none`}
      >
        <Check className="w-[70%] h-[70%] stroke-[3.5]" />
      </span>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 rounded bg-neutral-900 text-white text-[10px] font-sans font-medium whitespace-nowrap shadow-lg border border-neutral-700 pointer-events-none z-50">
          {current.label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
        </div>
      )}
    </div>
  );
};
