import type { CardBrand } from '@norte/contracts';

export interface BrandIconProps {
  brand: CardBrand;
  className?: string;
}

export function BrandIcon({ brand, className }: BrandIconProps) {
  if (brand === 'visa') {
    return (
      <svg
        className={className}
        width="36"
        height="24"
        viewBox="0 0 36 24"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="36" height="24" rx="4" fill="#1A1F71" />
        <text
          x="18"
          y="16"
          textAnchor="middle"
          fill="#fff"
          fontSize="9"
          fontFamily="var(--font-sans)"
          fontWeight="700"
        >
          VISA
        </text>
      </svg>
    );
  }

  if (brand === 'mastercard') {
    return (
      <svg
        className={className}
        width="36"
        height="24"
        viewBox="0 0 36 24"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="36" height="24" rx="4" fill="#252525" />
        <circle cx="14" cy="12" r="6" fill="#EB001B" />
        <circle cx="22" cy="12" r="6" fill="#F79E1B" />
        <path
          d="M18 7.5a6 6 0 0 1 0 9 6 6 0 0 1 0-9z"
          fill="#FF5F00"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width="36"
      height="24"
      viewBox="0 0 36 24"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        width="36"
        height="24"
        rx="4"
        fill="var(--color-border)"
        stroke="var(--color-text-muted)"
        strokeWidth="1"
      />
      <rect x="6" y="8" width="14" height="3" rx="1" fill="var(--color-text-muted)" />
      <rect x="6" y="14" width="24" height="2" rx="1" fill="var(--color-text-muted)" />
    </svg>
  );
}
