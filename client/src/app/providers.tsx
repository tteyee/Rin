import type { ReactNode } from "react";
import { Helmet } from "react-helmet";
import type { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";

export function AppProviders({
  children,
  config,
  profile,
}: {
  children: ReactNode;
  config: ConfigWrapper;
  profile: Profile | undefined | null;
}) {
  const headerCode = config.get<string>("custom.header_code") || "";
  const customCss = config.get<string>("custom.css") || "";
  const customScript = config.get<string>("custom.script") || "";

  const headerInjectScript = headerCode
    ? `(function(){var d=document.createElement('div');d.innerHTML=${JSON.stringify(headerCode)};Array.from(d.childNodes).forEach(function(n){document.head.appendChild(n.cloneNode(true));});})();`
    : "";

  return (
    <ClientConfigContext.Provider value={config}>
      <ProfileContext.Provider value={profile}>
        <Helmet>
          <link rel="icon" type="image/png" href="/favicon.png" />
          {headerInjectScript ? (
            <script data-lucky-header="1">{headerInjectScript}</script>
          ) : null}
          {customCss ? <style type="text/css">{customCss}</style> : null}
          {customScript ? (
            <script type="text/javascript">{customScript}</script>
          ) : null}
        </Helmet>
        {children}
      </ProfileContext.Provider>
    </ClientConfigContext.Provider>
  );
}
