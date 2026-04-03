import { useContext } from "react";
import { Helmet } from "react-helmet";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { stripImageUrlMetadata } from "../utils/image-upload";
import { ClientConfigContext } from "../state/config";

interface SiteMetaProps {
    title?: string;
    description?: string;
    image?: string;
    children: React.ReactNode;
}

// Component to provide site metadata for pages
export function SiteMeta({ title, description, image, children }: SiteMetaProps) {
    const siteConfig = useSiteConfig();
    const config = useContext(ClientConfigContext);

    const pageTitle = title 
        ? `${title} - ${siteConfig.name}` 
        : siteConfig.name;

    const pageDescription = description || siteConfig.description;
    const pageImage = stripImageUrlMetadata(image || siteConfig.avatar);

    const headCode = config.get<string>("custom.head_code") || "";
    const customCss = config.get<string>("custom.css") || "";
    const customScript = config.get<string>("custom.script") || "";

    return (
        <>
            <Helmet>
                <title>{pageTitle}</title>
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDescription} />
                {pageImage && <meta property="og:image" content={pageImage} />}
                {headCode && <meta name="lucky-custom-head" content="injected" />}
                {customCss && <style type="text/css">{customCss}</style>}
            </Helmet>
            {/* Custom head code injection */}
            {headCode && (
                <div
                    dangerouslySetInnerHTML={{ __html: headCode }}
                    style={{ display: "none" }}
                    id="lucky-head-injection"
                />
            )}
            {/* Custom script injection */}
            {customScript && (
                <div
                    dangerouslySetInnerHTML={{ __html: customScript }}
                    id="lucky-script-injection"
                />
            )}
            {children}
        </>
    );
}
