"use client";

const footerLinks = {
  Product: [
    { label: "Mint moonUSD", href: "/mint" },
    { label: "Vaults", href: "/vaults" },
    { label: "Card", href: "/card" },
    { label: "Stability Pool", href: "/stability-pool" },
  ],
  Resources: [
    { label: "Documentation", href: "https://docs.moonight.fun" },
    { label: "Whitepaper", href: "https://docs.moonight.fun/whitepaper" },
    { label: "API Reference", href: "https://docs.moonight.fun/api" },
    { label: "SDK", href: "https://docs.moonight.fun/sdk" },
    { label: "Blog", href: "https://moonight.fun/blog" },
  ],
  Company: [
    { label: "About", href: "https://moonight.fun/about" },
    { label: "Careers", href: "https://moonight.fun/careers" },
    { label: "Press", href: "https://moonight.fun/press" },
    { label: "Contact", href: "https://moonight.fun/contact" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "https://moonight.fun/privacy" },
    { label: "Terms of Service", href: "https://moonight.fun/terms" },
    { label: "Cookie Policy", href: "https://moonight.fun/cookies" },
  ],
};

const socialLinks = [
  { label: "Twitter", href: "https://twitter.com/moonightprotocol" },
  { label: "Telegram", href: "https://t.me/moonightprotocol" },
  { label: "GitHub", href: "https://github.com/moonightprotocol" },
  { label: "Discord", href: "https://discord.gg/cZa7YpyQ" },
];

export default function Footer() {
  const isMainnet = process.env.NEXT_PUBLIC_STARKNET_NETWORK === "mainnet";
  const networkLabel = isMainnet ? "Mainnet Beta" : "Sepolia Testnet";

  return (
    <footer className="border-t border-dark-700/50 bg-dark-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-white mb-4 tracking-wide">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => {
                  const isExternal = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-sm text-dark-400 hover:text-white transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-dark-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">M</span>
              </div>
              <span className="text-sm text-dark-400">
                &copy; {new Date().getFullYear()} Moonight Protocol.
              </span>
            </div>
            <span className="text-xs text-dark-500">
              {networkLabel} &middot; Built on Starknet
            </span>
          </div>

          <div className="flex items-center gap-6">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-dark-400 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
