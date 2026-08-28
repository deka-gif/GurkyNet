import React from 'react';
import { Link } from 'react-router-dom';
import type { HomepageSection } from '../../types';
import { CmsSectionShell } from './CmsSectionShell';
import { Button } from '../ui/Button';

type Props = { section: HomepageSection };

/**
 * Generic CMS block for statistics / partners / testimonials / why_us.
 * Marketing controls copy, items, CTA via Homepage Sections CMS.
 */
export const CmsContentSection: React.FC<Props> = ({ section }) => {
  const items = Array.isArray(section.contentItems) ? section.contentItems : [];
  const isPartners = section.componentType === 'partners';
  const isStats = section.componentType === 'statistics';

  const cta = section.buttonLabel ? (
    section.buttonUrl?.startsWith('http') ? (
      <a href={section.buttonUrl} target="_blank" rel="noreferrer" className="inline-flex">
        <Button variant="primary">{section.buttonLabel}</Button>
      </a>
    ) : (
      <Link to={section.buttonUrl || '/'} className="inline-flex">
        <Button variant="primary">{section.buttonLabel}</Button>
      </Link>
    )
  ) : null;

  return (
    <CmsSectionShell section={section}>
      <section className="py-16 md:py-24 public-section-alt">
        <div className="container mx-auto px-4 md:px-8 max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-12">
            {section.subtitle && (
              <p className="text-sm font-bold uppercase tracking-widest text-accent-600 mb-3">{section.subtitle}</p>
            )}
            <h2 className="section-title mb-4">{section.title}</h2>
            {section.description && (
              <p className="section-subtitle">{section.description}</p>
            )}
          </div>

          {items.length > 0 && (
            <div
              className={
                isPartners
                  ? 'flex flex-wrap items-center justify-center gap-4 md:gap-6'
                  : isStats
                    ? 'grid grid-cols-2 lg:grid-cols-4 gap-6'
                    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              }
            >
              {items.map((item, idx) => (
                <div
                  key={`${item.title || 'item'}-${idx}`}
                  className={
                    isPartners
                      ? 'px-5 py-3 rounded-full border border-primary-100 bg-primary-50/60 text-sm font-bold text-primary-800'
                      : 'public-card p-6 text-center md:text-left'
                  }
                >
                  {item.value && (
                    <p className="text-3xl md:text-4xl font-extrabold text-primary-600 mb-2">{item.value}</p>
                  )}
                  {item.image && (
                    <img src={item.image} alt={item.title || ''} className="h-12 w-auto mx-auto md:mx-0 mb-3 object-contain" />
                  )}
                  {item.title && <h3 className="text-lg font-extrabold text-gray-900">{item.title}</h3>}
                  {item.subtitle && <p className="text-sm font-semibold text-primary-600 mt-1">{item.subtitle}</p>}
                  {item.description && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.description}</p>}
                </div>
              ))}
            </div>
          )}

          {cta && <div className="mt-10 flex justify-center">{cta}</div>}
        </div>
      </section>
    </CmsSectionShell>
  );
};
