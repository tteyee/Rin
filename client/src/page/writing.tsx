import i18n from 'i18next';
import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import Loading from 'react-loading';
import { ShowAlertType, useAlert } from '../components/dialog';
import { Checkbox, Input } from "../components/input";
import { DateTimeInput, FlatMetaRow, FlatPanel } from "@rin/ui";
import { client } from "../app/runtime";
import { Cache } from '../utils/cache';
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { TiptapEditor } from '../components/tiptap_editor';

async function publish({
  title, alias, listed, content, summary, tags, draft, createdAt,
  meta_title, meta_description, og_image, scheduled_at,
  onCompleted, showAlert,
}: {
  title: string; listed: boolean; content: string; summary: string;
  tags: string[]; draft: boolean; alias?: string; createdAt?: Date;
  meta_title?: string; meta_description?: string; og_image?: string; scheduled_at?: string;
  onCompleted?: () => void; showAlert: ShowAlertType;
}) {
  const t = i18n.t;
  const { data, error } = await client.feed.create({
    title, alias, content, summary, tags, listed, draft,
    createdAt: createdAt?.toISOString(),
    meta_title, meta_description, og_image, scheduled_at,
  });
  onCompleted?.();
  if (error) showAlert(error.value as string);
  else if (data) showAlert(t("publish.success"), () => {
    Cache.with().clear();
    window.location.href = "/feed/" + data.insertedId;
  });
}

async function update({
  id, title, alias, content, summary, tags, listed, draft, createdAt,
  meta_title, meta_description, og_image, scheduled_at,
  onCompleted, showAlert,
}: {
  id: number; listed: boolean; title?: string; alias?: string; content?: string;
  summary?: string; tags?: string[]; draft?: boolean; createdAt?: Date;
  meta_title?: string; meta_description?: string; og_image?: string; scheduled_at?: string | null;
  onCompleted?: () => void; showAlert: ShowAlertType;
}) {
  const t = i18n.t;
  const { error } = await client.feed.update(id, {
    title, alias, content, summary, tags, listed, draft,
    createdAt: createdAt?.toISOString(),
    meta_title, meta_description, og_image, scheduled_at,
  });
  onCompleted?.();
  if (error) showAlert(error.value as string);
  else showAlert(t("update.success"), () => {
    Cache.with(id).clear();
    window.location.href = "/feed/" + id;
  });
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500 mb-2">
      {children}
    </p>
  );
}

export function WritingPage({ id }: { id?: number }) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const cache = Cache.with(id);

  const [title, setTitle] = cache.useCache("title", "");
  const [summary, setSummary] = cache.useCache("summary", "");
  const [tags, setTags] = cache.useCache("tags", "");
  const [alias, setAlias] = cache.useCache("alias", "");
  const [draft, setDraft] = useState(false);
  const [listed, setListed] = useState(true);
  const [content, setContent] = cache.useCache("content", "");
  const [createdAt, setCreatedAt] = useState<Date | undefined>(new Date());

  // SEO
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);

  // 예약 발행
  const [useSchedule, setUseSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | undefined>(undefined);

  const [publishing, setPublishing] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  useEffect(() => {
    if (!id) return;
    client.feed.get(id).then(({ data }) => {
      if (!data) return;
      if (title === "" && data.title) setTitle(data.title);
      if (tags === "" && data.hashtags)
        setTags(data.hashtags.map(({ name }: { name: string }) => `#${name}`).join(" "));
      if (alias === "" && (data as any).alias) setAlias((data as any).alias);
      if (content === "") setContent(data.content);
      if (summary === "") setSummary((data as any).summary || "");
      setListed((data as any).listed === 1);
      setDraft((data as any).draft === 1);
      setCreatedAt(new Date(data.createdAt));
      setMetaTitle(data.meta_title || "");
      setMetaDescription(data.meta_description || "");
      setOgImage(data.og_image || "");
      if (data.scheduled_at) {
        setUseSchedule(true);
        setScheduledAt(new Date(data.scheduled_at));
      }
    });
  }, []);

  function handlePublish() {
    if (publishing) return;
    const tagsplit = tags.split("#").filter(Boolean).map(t => t.trim());
    const scheduleIso = useSchedule && scheduledAt ? scheduledAt.toISOString() : undefined;

    if (id !== undefined) {
      setPublishing(true);
      update({
        id, title, content, summary, alias, tags: tagsplit, draft, listed, createdAt,
        meta_title: metaTitle, meta_description: metaDescription, og_image: ogImage,
        scheduled_at: scheduleIso ?? (useSchedule ? null : undefined),
        onCompleted: () => setPublishing(false), showAlert,
      });
    } else {
      if (!title) { showAlert(t("title_empty")); return; }
      if (!content) { showAlert(t("content.empty")); return; }
      setPublishing(true);
      publish({
        title, content, summary, tags: tagsplit, draft, alias, listed, createdAt,
        meta_title: metaTitle, meta_description: metaDescription, og_image: ogImage,
        scheduled_at: scheduleIso,
        onCompleted: () => setPublishing(false), showAlert,
      });
    }
  }

  function PublishButton({ className }: { className?: string }) {
    return (
      <button
        onClick={handlePublish}
        disabled={publishing}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-theme px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-theme-hover active:bg-theme-active disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
      >
        {publishing && <Loading type="spin" height={16} width={16} />}
        <span>
          {useSchedule && scheduledAt ? (t("writing.schedule") ?? "예약 발행") : t("publish.title")}
        </span>
      </button>
    );
  }

  function MetaPanel({ className }: { className?: string }) {
    return (
      <FlatPanel className={className}>
        {/* 헤더 */}
        <div className="flex flex-row gap-4 border-b border-black/5 pb-5 dark:border-white/5 items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">{t("writing")}</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {id !== undefined ? t("update.title") : t("publish.title")}
            </p>
          </div>
          <PublishButton className="w-auto" />
        </div>

        {/* 기본 입력 */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Input id={id} value={title} setValue={setTitle} placeholder={t("title")} variant="flat" className="text-base" />
          </div>
          <Input id={id} value={summary} setValue={setSummary} placeholder={t("summary")} variant="flat" />
          <Input id={id} value={alias} setValue={setAlias} placeholder={t("alias")} variant="flat" />
          <Input id={id} value={tags} setValue={setTags} placeholder={t("tags")} variant="flat" className="lg:col-span-2" />
        </div>

        {/* 옵션 행 */}
        <div className="mt-5 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
          <FlatMetaRow className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3" onClick={() => setDraft(!draft)}>
            <p>{t("visible.self_only")}</p>
            <Checkbox id="draft" value={draft} setValue={setDraft} placeholder={t("draft")} />
          </FlatMetaRow>
          <FlatMetaRow className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3" onClick={() => setListed(!listed)}>
            <p>{t("listed")}</p>
            <Checkbox id="listed" value={listed} setValue={setListed} placeholder={t("listed")} />
          </FlatMetaRow>
          <FlatMetaRow className="gap-3 rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3 xl:col-span-1">
            <p className="mr-2 whitespace-nowrap">{t("created_at")}</p>
            <DateTimeInput value={createdAt} onChange={setCreatedAt} className="w-full max-w-[16rem]" />
          </FlatMetaRow>
        </div>

        {/* 예약 발행 */}
        <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/5">
          <div className="flex cursor-pointer items-center gap-2 mb-3" onClick={() => setUseSchedule(!useSchedule)}>
            <Checkbox id="use_schedule" value={useSchedule} setValue={setUseSchedule} placeholder="" />
            <p className="text-sm t-primary select-none">{t("writing.use_schedule") ?? "예약 발행"}</p>
          </div>
          {useSchedule && (
            <div className="flex flex-wrap items-center gap-3 pl-1">
              <i className="ri-time-line text-theme" />
              <DateTimeInput value={scheduledAt} onChange={setScheduledAt} className="w-full max-w-[16rem]" />
              <p className="text-xs text-neutral-400">{t("writing.schedule_hint") ?? "설정 시간에 자동 발행됩니다"}</p>
            </div>
          )}
        </div>

        {/* SEO */}
        <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/5">
          <button type="button" onClick={() => setSeoOpen(!seoOpen)}
            className="flex w-full items-center justify-between text-sm t-primary">
            <span className="flex items-center gap-2 font-medium">
              <i className="ri-search-eye-line text-theme" />
              {t("writing.seo") ?? "SEO 설정"}
            </span>
            <i className={`ri-arrow-${seoOpen ? "up" : "down"}-s-line text-neutral-400`} />
          </button>
          {seoOpen && (
            <div className="mt-4 grid gap-4">
              <div>
                <SectionLabel>{t("writing.seo_title") ?? "SEO 제목"}</SectionLabel>
                <Input id={id} value={metaTitle} setValue={setMetaTitle}
                  placeholder={title || (t("writing.seo_title_placeholder") ?? "비워두면 글 제목 사용")} variant="flat" />
              </div>
              <div>
                <SectionLabel>{t("writing.seo_description") ?? "SEO 설명"}</SectionLabel>
                <Input id={id} value={metaDescription} setValue={setMetaDescription}
                  placeholder={t("writing.seo_description_placeholder") ?? "검색 결과에 표시될 설명 (160자 이내 권장)"} variant="flat" />
                <p className={`mt-1 text-right text-xs ${metaDescription.length > 160 ? "text-rose-400" : "text-neutral-400"}`}>
                  {metaDescription.length} / 160
                </p>
              </div>
              <div>
                <SectionLabel>{t("writing.og_image") ?? "OG 이미지 URL"}</SectionLabel>
                <Input id={id} value={ogImage} setValue={setOgImage}
                  placeholder={t("writing.og_image_placeholder") ?? "소셜 공유 시 표시될 이미지 URL"} variant="flat" />
              </div>
            </div>
          )}
        </div>
      </FlatPanel>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${t("writing")} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t("writing")} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <div className="mt-2 flex flex-col gap-4 t-primary sm:gap-6">
        {MetaPanel({ className: "p-4 sm:p-5 md:p-6" })}
        <FlatPanel className="overflow-hidden p-0">
          <TiptapEditor content={content} setContent={setContent} height="680px" />
        </FlatPanel>
      </div>
      <AlertUI />
    </>
  );
}
