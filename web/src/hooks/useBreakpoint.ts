import { useState, useEffect } from 'react';

export function useBreakpoint() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const mode: 'mobile' | 'tablet' | 'desktop' = isMobile
    ? 'mobile'
    : isTablet
    ? 'tablet'
    : 'desktop';

  return { isMobile, isTablet, isDesktop, mode, width };
}
