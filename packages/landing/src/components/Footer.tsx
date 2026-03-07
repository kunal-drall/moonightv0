"use client";

const footerLinks = {
  Product: [
    { label: "Features", href: "/#features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Vaults", href: "https://sepolia.moonight.fun/vaults" },
    { label: "Mint moonUSD", href: "https://sepolia.moonight.fun/mint" },
    { label: "Card", href: "https://sepolia.moonight.fun/card" },
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
  { label: "Twitter", href: "https://x.com/0xmoonight" },
  { label: "Telegram", href: "https://t.me/moonightprotocol" },
  { label: "GitHub", href: "https://github.com/kunal-drall/moonightv0" },
  { label: "Discord", href: "https://discord.gg/cZa7YpyQ" },
];

export default function Footer() {
  return (
    <footer className="border-t border-dark-700/50 bg-dark-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-white mb-4 tracking-wide">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-dark-400 hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-dark-700/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-sm text-dark-400">
              &copy; {new Date().getFullYear()} Moonight Protocol. Built on Starknet.
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
