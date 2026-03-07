"use client";

const socialLinks = [
  { label: "Docs", href: "https://docs.moonight.fun" },
  { label: "Twitter", href: "https://x.com/0xmoonight" },
  { label: "Discord", href: "https://discord.gg/cZa7YpyQ" },
  { label: "GitHub", href: "https://github.com/kunal-drall/moonightv0" },
  { label: "Telegram", href: "https://t.me/moonightprotocol" },
];

export default function Footer() {
  const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";
  const networkLabel = isMainnet ? "Mainnet" : "Sepolia";

  return (
    <footer className="border-t border-border/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-text-2 text-xs">
          {/* Inline crescent moon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="-76 -76 152 152"
            className="w-4 h-4 text-text-2"
            fill="currentColor"
          >
            <circle cx="0" cy="0" r="72" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <clipPath id="ftr-moon">
              <circle cx="0" cy="0" r="72" />
            </clipPath>
            <circle cx="22" cy="0" r="62" fill="currentColor" clipPath="url(#ftr-moon)" />
            <circle cx="-34" cy="-25" r="3.5" fill="currentColor" />
          </svg>
          <span className="font-display tracking-[0.15em] uppercase text-text-1 text-[10px]">
            Moonight
          </span>
          <span>&copy; {new Date().getFullYear()}</span>
          <span className="text-border">&middot;</span>
          <span>{networkLabel}</span>
        </div>

        <div className="flex items-center gap-5">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-text-2 hover:text-text-0 transition-colors duration-200 font-display tracking-wide"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
