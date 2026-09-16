import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Reset window scroll on pathname/search change (skip hash anchors). */
export function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    window.scrollTo(0, 0);
  }, [pathname, search, hash]);

  return null;
}
