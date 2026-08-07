import React from 'react';

const Block = ({ className = '' }: { className?: string }) => (
  <div className={`bg-gray-200/80 rounded-xl animate-pulse ${className}`} />
);

/** Progressive homepage placeholders — no fullscreen spinner. */
export const HomepageSkeleton: React.FC = () => (
  <div className="bg-gray-50">
    {/* Hero */}
    <section className="pt-28 pb-16 md:pt-40 md:pb-24">
      <div className="container mx-auto px-4 md:px-8 max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="space-y-4">
          <Block className="h-8 w-40" />
          <Block className="h-12 w-full max-w-xl" />
          <Block className="h-12 w-4/5 max-w-lg" />
          <Block className="h-20 w-full max-w-xl" />
          <div className="flex gap-3 pt-2">
            <Block className="h-12 w-40" />
            <Block className="h-12 w-40" />
          </div>
        </div>
        <Block className="h-72 md:h-96 w-full" />
      </div>
    </section>

    {/* Features */}
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4 max-w-7xl space-y-8">
        <Block className="h-8 w-64 mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Block className="h-40" />
          <Block className="h-40" />
          <Block className="h-40" />
        </div>
      </div>
    </section>

    {/* Banner */}
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <Block className="h-48 md:h-64 w-full" />
      </div>
    </section>

    {/* Categories */}
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4 max-w-7xl space-y-6">
        <Block className="h-8 w-56 mx-auto" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Block key={i} className="h-28" />
          ))}
        </div>
      </div>
    </section>

    {/* Partners */}
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-7xl flex flex-wrap justify-center gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Block key={i} className="h-10 w-28" />
        ))}
      </div>
    </section>

    {/* Footer strip */}
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-3xl space-y-3">
        <Block className="h-8 w-2/3 mx-auto" />
        <Block className="h-4 w-full" />
        <Block className="h-4 w-5/6 mx-auto" />
      </div>
    </section>
  </div>
);
