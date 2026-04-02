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

  return (
    <ClientConfigContext.Provider value={config}>
      <ProfileContext.Provider value={profile}>
        <Helmet>
          <link rel="icon" type="image/png" href="/favicon.png" />
          {headerCode ? (
            <script data-lucky-header="1">{`
              (function(){
                var el = document.createElement('div');
                el.innerHTML = ${JSON.stringify(headerCode)};
                Array.from(el.childNodes).forEach(function(n){ document.head.appendChild(n.cloneNode(true)); });
              })();
            `}</script>
          ) : null}
          {customCss ? <style type="text/css">{customCss}</style> : null}
          {customScript ? <script type="text/javascript">{customScript}</script> : null}
        </Helmet>
        {children}
      </ProfileContext.Provider>
    </ClientConfigContext.Provider>
  );
}
