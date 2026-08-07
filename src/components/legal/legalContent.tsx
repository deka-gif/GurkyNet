import { useEffect, useMemo, useState } from 'react';

export type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

function slugify(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^\w\u00C0-\u024f\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
  return `${base || 'section'}-${index}`;
}

/** Inject stable ids into h2/h3 and extract TOC. */
export function prepareLegalHtml(html: string): { html: string; toc: TocItem[] } {
  if (!html) return { html: '', toc: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, 'text/html');
  const root = doc.getElementById('root');
  if (!root) return { html, toc: [] };

  const toc: TocItem[] = [];
  let i = 0;
  root.querySelectorAll('h2, h3').forEach((el) => {
    const level = el.tagName.toLowerCase() === 'h2' ? 2 : 3;
    const text = (el.textContent || '').trim();
    if (!text) return;
    const id = el.getAttribute('id') || slugify(text, i++);
    el.setAttribute('id', id);
    toc.push({ id, text, level: level as 2 | 3 });
  });

  return { html: root.innerHTML, toc };
}

type Props = {
  html: string;
  className?: string;
};

export function LegalProse({ html, className = '' }: Props) {
  const prepared = useMemo(() => prepareLegalHtml(html), [html]);

  return (
    <div
      className={`legal-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: prepared.html }}
    />
  );
}

export function useLegalToc(html: string): TocItem[] {
  const [toc, setToc] = useState<TocItem[]>([]);
  useEffect(() => {
    setToc(prepareLegalHtml(html).toc);
  }, [html]);
  return toc;
}

export const LEGAL_SLUGS = ['privacy-policy', 'terms-conditions', 'refund-policy'] as const;

export function isLegalSlug(slug?: string | null): boolean {
  return !!slug && (LEGAL_SLUGS as readonly string[]).includes(slug);
}

export function legalPath(slug: string): string {
  return `/legal/${slug}`;
}
