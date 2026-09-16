import React from 'react';

const Block = ({ className = '' }: { className?: string }) => (
  <div className={`bg-gray-200/80 rounded-xl animate-pulse ${className}`} />
);

/**
 * Homepage loading placeholders — mobile-first (Masalah 3).
 * Mobile: short first-fold only (~1–1.5 screens). Desktop: fuller layout via md+/lg+.
 */
export const HomepageSkeleton: React.FC = () => (
  <div className="bg-gray-50">
    {/* Hero — compact on phone; dual-column media only from lg */}
    <section className="pt-20 pb-8 md:pt-40 md:pb-24">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
        <div className="space-y-3 md:space-y-4">
          <Block className="h-5 w-28 md:h-8 md:w-40" />
          <Block className="h-8 w-full max-w-xl md:h-12" />
          <Block className="h-8 w-3/4 max-w-lg md:h-12 md:w-4/5" />
          <Block className="h-12 w-full max-w-xl md:h-20" />
          <div className="flex gap-2 md:gap-3 pt-1 md:pt-2">
            <Block className="h-10 w-32 md:h-12 md:w-40" />
            <Block className="h-10 w-28 md:h-12 md:w-40" />
          </div>
        </div>
        {/* Shorter on mobile; taller from md; only needed strongly on lg split */}
        <Block className="h-40 sm:h-48 md:h-72 lg:h-96 w-full" />
      </div>
    </section>

    {/* Features — 2 compact cards on mobile (not 3 full-height stacks); 3 from md */}
    <section className="py-6 md:py-12 bg-white">
      <div className="container mx-auto px-4 max-w-7xl space-y-4 md:space-y-8">
        <Block className="h-6 w-40 mx-auto md:h-8 md:w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          <Block className="h-24 md:h-40" />
          <Block className="h-24 md:h-40" />
          <Block className="hidden md:block h-40" />
        </div>
      </div>
    </section>

    {/* Banner — shorter on mobile */}
    <section className="py-6 md:py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <Block className="h-28 sm:h-36 md:h-64 w-full" />
      </div>
    </section>

    {/* Categories — 4 tiles (2×2) on mobile; full 8 from md */}
    <section className="py-6 md:py-12 bg-white">
      <div className="container mx-auto px-4 max-w-7xl space-y-4 md:space-y-6">
        <Block className="h-6 w-36 mx-auto md:h-8 md:w-56" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Block
              key={i}
              className={`h-20 md:h-28 ${i >= 4 ? 'hidden md:block' : ''}`}
            />
          ))}
        </div>
      </div>
    </section>

    {/* Partners + footer strip — desktop only (below fold noise on phone) */}
    <section className="hidden md:block py-12">
      <div className="container mx-auto px-4 max-w-7xl flex flex-wrap justify-center gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-10 w-28" />
        ))}
      </div>
    </section>

    <section className="hidden md:block py-16 bg-white">
      <div className="container mx-auto px-4 max-w-3xl space-y-3">
        <Block className="h-8 w-2/3 mx-auto" />
        <Block className="h-4 w-full" />
        <Block className="h-4 w-5/6 mx-auto" />
      </div>
    </section>
  </div>
);
