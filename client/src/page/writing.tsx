import i18n from 'i18next';
import _ from 'lodash';
import {useCallback, useEffect, useState} from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import Loading from 'react-loading';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
import { DateTimeInput, FlatMetaRow, FlatPanel } from "@rin/ui";
import { client } from "../app/runtime";
import {Cache} from '../utils/cache';
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants";
import mermaid from 'mermaid';
import { MarkdownEditor } from '../components/markdown_editor';

// ─── 카테고리 타입 ─────────────────────────────────────────────────────────────
type Category = { id: number; name: string; slug: string };

async function publish({
  title, alias, listed, content, summary, tags, draft, createdAt, category_id, onCompleted, showAlert
}: {
  title: string; listed: boolean; content: string; summary: string;
  tags: string[]; draft: boolean; alias?: string; createdAt?: Date;
  category_id?: number | null; onCompleted?: () => void; showAlert: ShowAlertType;
}) {
  const t = i18n.t;
  const { data, error } = await client.feed.create({
    title, alias, content, summary, tags, listed, draft,
    createdAt: createdAt?.toISOString(),
    category_id: category_id ?? undefined,
  } as any);
  if (onCompleted) onCompleted();
  if (error) showAlert(error.value as string);
  if (data) {
    showAlert(t("publish.success"), () => {
      Cache.with().clear();
      window.location.href = "/feed/" + data.insertedId;
    });
  }
}

async function update({
  id, title, alias, content, summary, tags, listed, draft, createdAt, category_id, onCompleted, showAlert
}: {
  id: number; listed: boolean; title?: string; alias?: string; content?: string;
  summary?: string; tags?: string[]; draft?: boolean; createdAt?: Date;
  category_id?: number | null; onCompleted?: () => void; showAlert: ShowAlertType;
}) {
  const t = i18n.t;
  const { error } = await client.feed.update(id, {
    title, alias, content, summary, tags, listed, draft,
    createdAt: createdAt?.toISOString(),
    category_id: category_id ?? undefined,
  } as any);
  if (onCompleted) onCompleted();
  if (error) showAlert(error.value as string);
  else {
    showAlert(t("update.success"), () => {
      Cache.with(id).clear();
      window.location.href = "/feed/" + id;
    });
  }
}

// 写作页面
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
  const [publishing, setPublishing] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const { showAlert, AlertUI } = useAlert();

  // 카테고리 목록 로드
  useEffect(() => {
    fetch("/api/category")
      .then((r) => r.json())
      .then((data: any[]) => setCategories(data))
      .catch(() => {});
  }, []);

  function publishButton() {
    if (publishing) return;
    const tagsplit = tags.split("#").filter((tag) => tag !== "").map((tag) => tag.trim()) || [];
    if (id !== undefined) {
      setPublishing(true);
      update({ id, title, content, summary, alias, tags: tagsplit, draft, listed, createdAt, category_id: categoryId, onCompleted: () => setPublishing(false), showAlert });
    } else {
      if (!title) { showAlert(t("title_empty")); return; }
      if (!content) { showAlert(t("content.empty")); return; }
      setPublishing(true);
      publish({ title, content, summary, tags: tagsplit, draft, alias, listed, createdAt, category_id: categoryId, onCompleted: () => setPublishing(false), showAlert });
    }
  }

  useEffect(() => {
    if (id) {
      client.feed.get(id).then(({ data }) => {
        if (data) {
          if (title == "" && data.title) setTitle(data.title);
          if (tags == "" && data.hashtags)
            setTags(data.hashtags.map(({ name }: {name: string}) => `#${name}`).join(" "));
          if (alias == "" && (data as any).alias) setAlias((data as any).alias);
          if (content == "") setContent(data.content);
          if (summary == "") setSummary((data as any).summary || "");
          setListed((data as any).listed === 1);
          setDraft((data as any).draft === 1);
          setCreatedAt(new Date(data.createdAt));
          if ((data as any).category_id) setCategoryId((data as any).category_id);
        }
      });
    }
  }, []);

  const debouncedUpdate = useCallback(
    _.debounce(() => {
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      mermaid.run({ suppressErrors: true, nodes: document.querySelectorAll("pre.mermaid_default") }).then(() => {
        mermaid.initialize({ startOnLoad: false, theme: "dark" });
        mermaid.run({ suppressErrors: true, nodes: document.querySelectorAll("pre.mermaid_dark") });
      });
    }, 100),
    []
  );

  useEffect(() => { debouncedUpdate(); }, [content, debouncedUpdate]);

  function PublishButton({ className }: { className?: string }) {
    return (
      <button
        onClick={publishButton}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-theme px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-theme-hover active:bg-theme-active disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
        disabled={publishing}
      >
        {publishing && <Loading type="spin" height={16} width={16} />}
        <span>{t('publish.title')}</span>
      </button>
    );
  }

  function MetaInput({ className }: { className?: string }) {
    return (
      <FlatPanel className={className}>
        <div className="flex flex-row gap-4 border-b border-black/5 pb-5 dark:border-white/5 items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">{t('writing')}</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {id !== undefined ? t("update.title") : t("publish.title")}
            </p>
          </div>
          <PublishButton className="w-auto" />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <Input id={id} value={title} setValue={setTitle} placeholder={t("title")} variant="flat" className="text-base" />
          </div>
          <Input id={id} value={summary} setValue={setSummary} placeholder={t("summary")} variant="flat" />
          <Input id={id} value={alias} setValue={setAlias} placeholder={t("alias")} variant="flat" />
          <Input id={id} value={tags} setValue={setTags} placeholder={t("tags")} variant="flat" className="lg:col-span-2" />

          {/* 카테고리 선택 */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-secondary px-4 py-3 dark:border-white/10">
              <i className="ri-price-tag-3-line text-theme" />
              <span className="text-sm t-primary whitespace-nowrap">카테고리</span>
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                className="flex-1 bg-transparent text-sm t-primary outline-none cursor-pointer"
              >
                <option value="">카테고리 없음</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
          <FlatMetaRow className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3" onClick={() => setDraft(!draft)}>
            <p>{t('visible.self_only')}</p>
            <Checkbox id="draft" value={draft} setValue={setDraft} placeholder={t('draft')} />
          </FlatMetaRow>
          <FlatMetaRow className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3" onClick={() => setListed(!listed)}>
            <p>{t('listed')}</p>
            <Checkbox id="listed" value={listed} setValue={setListed} placeholder={t('listed')} />
          </FlatMetaRow>
          <FlatMetaRow className="gap-3 rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3 xl:col-span-1">
            <p className="mr-2 whitespace-nowrap">{t('created_at')}</p>
            <DateTimeInput value={createdAt} onChange={setCreatedAt} className="w-full max-w-[16rem]" />
          </FlatMetaRow>
        </div>
      </FlatPanel>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${t('writing')} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('writing')} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <div className="mt-2 flex flex-col gap-4 t-primary sm:gap-6">
        {MetaInput({ className: "p-4 sm:p-5 md:p-6" })}
        <FlatPanel className="overflow-hidden p-0">
          <MarkdownEditor content={content} setContent={setContent} height='680px' />
        </FlatPanel>
      </div>
      <AlertUI />
    </>
  );
}

import _ from 'lodash';
import {useCallback, useEffect, useState} from "react";
import {Helmet} from "react-helmet";
import {useTranslation} from "react-i18next";
import Loading from 'react-loading';
import {ShowAlertType, useAlert} from '../components/dialog';
import {Checkbox, Input} from "../components/input";
import { DateTimeInput, FlatMetaRow, FlatPanel } from "@rin/ui";
import { client } from "../app/runtime";
import {Cache} from '../utils/cache';
import {useSiteConfig} from "../hooks/useSiteConfig";
import {siteName} from "../utils/constants";
import mermaid from 'mermaid';
import { MarkdownEditor } from '../components/markdown_editor';

async function publish({
  title,
  alias,
  listed,
  content,
  summary,
  tags,
  draft,
  createdAt,
  onCompleted,
  showAlert
}: {
  title: string;
  listed: boolean;
  content: string;
  summary: string;
  tags: string[];
  draft: boolean;
  alias?: string;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
  const t = i18n.t
  const { data, error } = await client.feed.create(
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
  }
  if (data) {
    showAlert(t("publish.success"), () => {
      Cache.with().clear();
      window.location.href = "/feed/" + data.insertedId;
    });
  }
}

async function update({
  id,
  title,
  alias,
  content,
  summary,
  tags,
  listed,
  draft,
  createdAt,
  onCompleted,
  showAlert
}: {
  id: number;
  listed: boolean;
  title?: string;
  alias?: string;
  content?: string;
  summary?: string;
  tags?: string[];
  draft?: boolean;
  createdAt?: Date;
  onCompleted?: () => void;
  showAlert: ShowAlertType;
}) {
  const t = i18n.t
  const { error } = await client.feed.update(
    id,
    {
      title,
      alias,
      content,
      summary,
      tags,
      listed,
      draft,
      createdAt: createdAt?.toISOString(),
    }
  );
  if (onCompleted) {
    onCompleted();
  }
  if (error) {
    showAlert(error.value as string);
  } else {
    showAlert(t("update.success"), () => {
      Cache.with(id).clear();
      window.location.href = "/feed/" + id;
    });
  }
}

// 写作页面
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
  const [publishing, setPublishing] = useState(false)
  const { showAlert, AlertUI } = useAlert()
  function publishButton() {
    if (publishing) return;
    const tagsplit =
      tags
        .split("#")
        .filter((tag) => tag !== "")
        .map((tag) => tag.trim()) || [];
    if (id !== undefined) {
      setPublishing(true)
      update({
        id,
        title,
        content,
        summary,
        alias,
        tags: tagsplit,
        draft,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert
      });
    } else {
      if (!title) {
        showAlert(t("title_empty"))
        return;
      }
      if (!content) {
        showAlert(t("content.empty"))
        return;
      }
      setPublishing(true)
      publish({
        title,
        content,
        summary,
        tags: tagsplit,
        draft,
        alias,
        listed,
        createdAt,
        onCompleted: () => {
          setPublishing(false)
        },
        showAlert
      });
    }
  }

  useEffect(() => {
    if (id) {
      client.feed
        .get(id)
        .then(({ data }) => {
          if (data) {
            if (title == "" && data.title) setTitle(data.title);
            if (tags == "" && data.hashtags)
              setTags(data.hashtags.map(({ name }: {name: string}) => `#${name}`).join(" "));
            if (alias == "" && (data as any).alias) setAlias((data as any).alias);
            if (content == "") setContent(data.content);
            if (summary == "") setSummary((data as any).summary || "");
            setListed((data as any).listed === 1);
            setDraft((data as any).draft === 1);
            setCreatedAt(new Date(data.createdAt));
          }
        });
    }
  }, []);
  const debouncedUpdate = useCallback(
    _.debounce(() => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
      });
      mermaid.run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_default")
      }).then(()=>{
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
        });
        mermaid.run({
          suppressErrors: true,
          nodes: document.querySelectorAll("pre.mermaid_dark")
        });
      })
    }, 100),
    []
  );
  useEffect(() => {
    debouncedUpdate();
  }, [content, debouncedUpdate]);
  function PublishButton({ className }: { className?: string }) {
    return (
      <button
        onClick={publishButton}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-theme px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-theme-hover active:bg-theme-active disabled:cursor-not-allowed disabled:opacity-60 ${className ?? ""}`}
        disabled={publishing}
      >
        {publishing && <Loading type="spin" height={16} width={16} />}
        <span>{t('publish.title')}</span>
      </button>
    );
  }

  function MetaInput({ className }: { className?: string }) {
    return (
        <FlatPanel className={className}>
          <div className="flex flex-row gap-4 border-b border-black/5 pb-5 dark:border-white/5 items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">{t('writing')}</p>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                {id !== undefined ? t("update.title") : t("publish.title")}
              </p>
            </div>
            <PublishButton className="w-auto" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Input
                id={id}
                value={title}
                setValue={setTitle}
                placeholder={t("title")}
                variant="flat"
                className="text-base"
              />
            </div>
            <Input
              id={id}
              value={summary}
              setValue={setSummary}
              placeholder={t("summary")}
              variant="flat"
            />
            <Input
              id={id}
              value={alias}
              setValue={setAlias}
              placeholder={t("alias")}
              variant="flat"
            />
            <Input
              id={id}
              value={tags}
              setValue={setTags}
              placeholder={t("tags")}
              variant="flat"
              className="lg:col-span-2"
            />
          </div>

          <div className="mt-5 grid gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(18rem,2fr)]">
            <FlatMetaRow
              className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
              onClick={() => setDraft(!draft)}
            >
              <p>{t('visible.self_only')}</p>
              <Checkbox
                id="draft"
                value={draft}
                setValue={setDraft}
                placeholder={t('draft')}
              />
            </FlatMetaRow>
            <FlatMetaRow
              className="cursor-pointer rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3"
              onClick={() => setListed(!listed)}
            >
              <p>{t('listed')}</p>
              <Checkbox
                id="listed"
                value={listed}
                setValue={setListed}
                placeholder={t('listed')}
              />
            </FlatMetaRow>
            <FlatMetaRow className="gap-3 rounded-none border-0 bg-transparent px-0 py-2 sm:rounded-2xl sm:border sm:bg-secondary sm:px-4 sm:py-3 xl:col-span-1">
              <p className="mr-2 whitespace-nowrap">
                {t('created_at')}
              </p>
              <DateTimeInput value={createdAt} onChange={setCreatedAt} className="w-full max-w-[16rem]" />
            </FlatMetaRow>
          </div>
        </FlatPanel>
    )
  }

  return (
    <>
      <Helmet>
        <title>{`${t('writing')} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('writing')} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <div className="mt-2 flex flex-col gap-4 t-primary sm:gap-6">
        {MetaInput({ className: "p-4 sm:p-5 md:p-6" })}

        <FlatPanel className="overflow-hidden p-0">
          <MarkdownEditor content={content} setContent={setContent} height='680px' />
        </FlatPanel>
      </div>
      <AlertUI />
    </>
  );
}
