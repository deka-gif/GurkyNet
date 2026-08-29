import { resolveMediaUrl } from '../../utils/mediaUrl';

const BRAND_GRADIENTS = [
  'from-primary-500 to-primary-800',
  'from-primary-600 to-primary-900',
  'from-emerald-500 to-teal-800',
  'from-teal-600 to-primary-900',
  'from-primary-700 to-emerald-900',
  'from-emerald-600 to-primary-800',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

interface BrandAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'h-10 w-10 text-xs rounded-xl',
  md: 'h-12 w-12 text-sm rounded-2xl',
  lg: 'h-14 w-14 text-base rounded-2xl',
};

/**
 * Provider / brand avatar — shows real logo when API supplies one, else styled initials.
 * Digiflazz/VIP do not sync logos; Operations must upload curated assets (FR-OPS-03).
 */
export function BrandAvatar({ name, logoUrl, size = 'md', className = '' }: BrandAvatarProps) {
  const resolved = resolveMediaUrl(logoUrl || '');
  const gradient = BRAND_GRADIENTS[hashName(name) % BRAND_GRADIENTS.length];
  const dim = sizeMap[size];

  if (resolved) {
    return (
      <div
        className={`${dim} shrink-0 overflow-hidden border border-white/80 bg-white shadow-sm ${className}`}
      >
        <img src={resolved} alt={name} className="h-full w-full object-contain p-1.5" loading="lazy" />
      </div>
    );
  }

  return (
    <div
      className={`${dim} shrink-0 flex items-center justify-center font-black text-white bg-gradient-to-br ${gradient} shadow-md shadow-primary-900/15 border border-white/20 ${className}`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

export function providerLogoFromProduct(product?: {
  providerDetails?: { logo?: string | null };
  provider?: string;
} | null): string | null {
  const logo = product?.providerDetails?.logo;
  if (!logo || logo.endsWith('.png') && !logo.includes('/')) {
    // Auto-generated slug placeholder from sync — not a real uploaded asset
    return null;
  }
  return logo;
}
