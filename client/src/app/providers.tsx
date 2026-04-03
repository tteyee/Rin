import type { ReactNode } from "react";
import { useContext, useEffect } from "react";
import { Helmet } from "react-helmet";
import type { ConfigWrapper } from "@rin/config";
import type { Profile } from "../state/profile";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";

// head_code / custom_css 를 실제 DOM에 주입하는 컴포넌트
function GlobalInjector() {
  const config = useContext(ClientConfigContext);

  const headCode = String(config.get("head_code") ?? "");
  const customCss = String(config.get("custom_css") ?? "");

  // custom_css: <style> 태그로 주입
  useEffect(() => {
    const styleId = "lucky-custom-css";
    let el = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = styleId;
      document.head.appendChild(el);
    }
    el.textContent = customCss;
    return () => { /* 언마운트 시 유지 */ };
  }, [customCss]);

  // head_code: dangerouslySetInnerHTML 대신 Helmet의 script/meta 지원 범위 밖이므로
  // useEffect로 직접 파싱해서 삽입
  useEffect(() => {
    if (!headCode) return;
    const containerId = "lucky-head-code";
    // 기존 삽입 제거
    document.getElementById(containerId)?.remove();

    const container = document.createElement("div");
    container.id = containerId;
    // HTML 파싱 후 head에 script/meta/link 태그만 삽입
    const tmp = document.createElement("div");
    tmp.innerHTML = headCode;
    Array.from(tmp.children).forEach((node) => {
      const tag = node.tagName.toLowerCase();
      if (["script", "meta", "link", "style", "noscript"].includes(tag)) {
        // script는 새로 생성해야 실행됨
        if (tag === "script") {
          const s = document.createElement("script");
          Array.from(node.attributes).forEach((attr) => s.setAttribute(attr.name, attr.value));
          s.textContent = node.textContent || "";
          document.head.appendChild(s);
        } else {
          document.head.appendChild(node.cloneNode(true));
        }
      }
    });
  }, [headCode]);

  return null;
}

export function AppProviders({
  children,
  config,
  profile,
}: {
  children: ReactNode;
  config: ConfigWrapper;
  profile: Profile | undefined | null;
}) {
  return (
    <ClientConfigContext.Provider value={config}>
      <ProfileContext.Provider value={profile}>
        <Helmet>
          <link rel="icon" href="/favicon.ico" />
        </Helmet>
        <GlobalInjector />
        {children}
      </ProfileContext.Provider>
    </ClientConfigContext.Provider>
  );
}
