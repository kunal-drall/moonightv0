import { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 700, fontSize: "1.2rem" }}>
      Moonight Docs
    </span>
  ),
  project: {
    link: "https://github.com/kunal-drall/moonightv0",
  },
  chat: {
    link: "https://discord.gg/cZa7YpyQ",
  },
  docsRepositoryBase:
    "https://github.com/kunal-drall/moonightv0/tree/main/packages/docs",
  footer: {
    content: (
      <span>
        {new Date().getFullYear()} Moonight Protocol. Built on Starknet.
      </span>
    ),
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Moonight Protocol Documentation" />
      <meta name="og:title" content="Moonight Docs" />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
  },
};

export default config;
