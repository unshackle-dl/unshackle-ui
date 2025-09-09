'use client';

interface CountryFlagProps {
  countryCode: string;
  title: string;
  className?: string;
}

export function CountryFlag({ countryCode, title, className = '' }: CountryFlagProps) {
  if (!countryCode) {
    return (
      <span className={`inline-block text-base ${className}`} title={title}>
        🌐
      </span>
    );
  }

  // Use CSS-based flags instead of React components for better compatibility

  return (
    <span
      className={`flag-icon flag-icon-${countryCode.toLowerCase()} inline-block ${className}`}
      title={title}
      style={{
        width: '1.2em',
        height: '0.9em',
        backgroundImage: `url("https://flagcdn.com/w20/${countryCode.toLowerCase()}.png")`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        display: 'inline-block',
        borderRadius: '2px',
      }}
    />
  );
}
