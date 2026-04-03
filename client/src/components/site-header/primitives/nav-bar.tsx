import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { ClientConfigContext } from "../../../state/config";

export function NavBar({
  menu,
  onClick,
  itemClassName = "",
}: {
  menu: boolean;
  onClick?: () => void;
  itemClassName?: string;
}) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const config = useContext(ClientConfigContext);

  const show = (key: string) => config.get<boolean>(key) !== false;

  return (
    <>
      {show("nav.show.feeds") && (
        <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("article.title")} selected={location === "/" || location.startsWith("/feed")} href="/" />
      )}
      {show("nav.show.timeline") && (
        <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("timeline")} selected={location === "/timeline"} href="/timeline" />
      )}
      {show("nav.show.moments") && (
        <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("moments.title")} selected={location === "/moments"} href="/moments" />
      )}
      {show("nav.show.hashtags") && (
        <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("hashtags")} selected={location === "/hashtags"} href="/hashtags" />
      )}
      {show("nav.show.friends") && (
        <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("friends.title")} selected={location === "/friends"} href="/friends" />
      )}
      {show("nav.show.about") && (
        <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("about.title")} selected={location === "/about"} href="/about" />
      )}
    </>
  );
}

function NavItem({
  menu,
  title,
  selected,
  href,
  when = true,
  onClick,
  itemClassName = "",
}: {
  title: string;
  selected: boolean;
  href: string;
  menu?: boolean;
  when?: boolean;
  onClick?: () => void;
  itemClassName?: string;
}) {
  return when ? (
    <Link
      href={href}
      className={`${menu ? "" : "hidden"} md:block cursor-pointer hover:text-theme duration-300 px-2 py-4 md:p-4 text-sm ${
        selected ? "text-theme" : "dark:text-white"
      } ${itemClassName}`}
      state={{ animate: true }}
      onClick={onClick}
    >
      {title}
    </Link>
  ) : null;
}
