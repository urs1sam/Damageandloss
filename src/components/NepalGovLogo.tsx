import React from 'react';

export const NepalGovLogo: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => {
  return (
    <div
      className={`relative shrink-0 rounded-xl bg-white p-1 shadow-sm border border-slate-200/80 flex items-center justify-center overflow-hidden ${className}`}
      title="Government of Nepal - National Emblem / Ministry of Home Affairs"
    >
      <img
        src="/assets/aistudio/1280px-Emblem_of_Nepal.svg_ee194173.webp"
        alt="Emblem of Nepal"
        className="w-full h-full object-contain"
      />
    </div>
  );
};
