import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";
import { FlatInset, FlatTabButton } from "@rin/ui";
import { useAlert } from "./dialog";
import { uploadImageFile } from "../utils/image-upload";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TiptapImage from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import { Markdown as TiptapMarkdown } from "tiptap-markdown";

const lowlight = createLowlight();

type EditorMode = "rich" | "markdown" | "html";

interface TiptapEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
}

function ToolbarButton({
  onClick,
  active,
  title,
  icon,
  disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  icon: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors",
        active
          ? "bg-theme/15 text-theme"
          : "text-neutral-500 hover:bg-black/5 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ].join(" ")}
    >
      <i className={icon} />
    </button>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />;
}

function getMarkdown(editor: ReturnType<typeof useEditor>): string {
  if (!editor) return "";
  // tiptap-markdown이 storage에 주입하는 getMarkdown 함수
  const storage = editor.storage as Record<string, unknown>;
  const md = storage["markdown"] as { getMarkdown?: () => string } | undefined;
  return md?.getMarkdown?.() ?? editor.getText();
}

export function TiptapEditor({
  content,
  setContent,
  placeholder = "내용을 입력하세요...",
  height = "400px",
}: TiptapEditorProps) {
  const { t } = useTranslation();
  const { showAlert, AlertUI } = useAlert();

  const [mode, setMode] = useState<EditorMode>("rich");
  const [rawText, setRawText] = useState("");
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false }),
      TiptapImage,
      Placeholder.configure({ placeholder }),
      CodeBlockLowlight.configure({ lowlight }),
      TiptapMarkdown.configure({ transformPastedText: true }),
    ],
    content: "",
    onUpdate({ editor: e }) {
      if (mode === "rich") {
        setContent(getMarkdown(e));
      }
    },
  });

  // 초기 콘텐츠 로드 (1회만)
  useEffect(() => {
    if (!editor || initializedRef.current || !content) return;
    initializedRef.current = true;
    editor.commands.setContent(content);
  }, [editor, content]);

  // 모드 전환
  const switchMode = (next: EditorMode) => {
    if (!editor || mode === next) return;

    if (mode === "rich") {
      const md = getMarkdown(editor);
      setRawText(next === "html" ? editor.getHTML() : md);
    } else if (next === "rich") {
      if (mode === "markdown") {
        editor.commands.setContent(rawText);
        setContent(rawText);
      } else {
        editor.commands.setContent(rawText);
        setContent(getMarkdown(editor));
      }
    } else {
      if (mode === "markdown") {
        editor.commands.setContent(rawText);
        setRawText(editor.getHTML());
      } else {
        editor.commands.setContent(rawText);
        setRawText(getMarkdown(editor));
      }
    }
    setMode(next);
  };

  useEffect(() => {
    if (mode !== "rich") setContent(rawText);
  }, [rawText]);

  // 이미지 업로드
  const handleImageUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      showAlert(t("upload.failed$size", { size: 5 }));
      return;
    }
    setUploading(true);
    try {
      const result = await uploadImageFile(file);
      if (mode === "rich" && editor) {
        editor.chain().focus().setImage({ src: result.url, alt: file.name }).run();
        setContent(getMarkdown(editor));
      } else if (mode === "markdown") {
        setRawText((prev) => prev + `\n![${file.name}](${result.url})\n`);
      } else {
        setRawText((prev) => prev + `\n<img src="${result.url}" alt="${file.name}" />\n`);
      }
    } catch (e) {
      showAlert(e instanceof Error ? e.message : t("upload.failed"));
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) void handleImageUpload(file);
    e.currentTarget.value = "";
  };

  const onPaste = async (e: React.ClipboardEvent) => {
    const file = e.clipboardData.files[0];
    if (file?.type.startsWith("image/")) {
      e.preventDefault();
      await handleImageUpload(file);
    }
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) await handleImageUpload(file);
  };

  function RichToolbar() {
    if (!editor) return null;
    return (
      <div className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton icon="ri-bold" title="굵게 (Ctrl+B)" active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolbarButton icon="ri-italic" title="기울임 (Ctrl+I)" active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolbarButton icon="ri-underline" title="밑줄 (Ctrl+U)" active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolbarButton icon="ri-strikethrough" title="취소선" active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolbarDivider />
        <ToolbarButton icon="ri-h-1" title="제목 1" active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolbarButton icon="ri-h-2" title="제목 2" active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolbarButton icon="ri-h-3" title="제목 3" active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <ToolbarDivider />
        <ToolbarButton icon="ri-list-unordered" title="순서 없는 목록" active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolbarButton icon="ri-list-ordered" title="순서 있는 목록" active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolbarButton icon="ri-double-quotes-l" title="인용구" active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolbarButton icon="ri-code-line" title="인라인 코드" active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()} />
        <ToolbarButton icon="ri-code-block" title="코드 블록" active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <ToolbarDivider />
        <ToolbarButton icon="ri-link" title="링크" active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("URL을 입력하세요:");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }} />
        <ToolbarButton icon="ri-link-unlink" title="링크 제거" disabled={!editor.isActive("link")}
          onClick={() => editor.chain().focus().unsetLink().run()} />
        <ToolbarDivider />
        <ToolbarButton icon="ri-arrow-go-back-line" title="실행 취소 (Ctrl+Z)"
          onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton icon="ri-arrow-go-forward-line" title="다시 실행 (Ctrl+Y)"
          onClick={() => editor.chain().focus().redo().run()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      <FlatInset className="flex flex-col gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-3 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-2">
          <FlatTabButton active={mode === "rich"} onClick={() => switchMode("rich")}>
            {t("editor.rich") ?? "리치 텍스트"}
          </FlatTabButton>
          <FlatTabButton active={mode === "markdown"} onClick={() => switchMode("markdown")}>
            {t("editor.markdown") ?? "마크다운"}
          </FlatTabButton>
          <FlatTabButton active={mode === "html"} onClick={() => switchMode("html")}>
            {t("editor.html") ?? "HTML"}
          </FlatTabButton>
          <div className="flex-grow" />
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
          >
            <input
              ref={uploadRef}
              type="file"
              accept="image/gif,image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={onFileChange}
            />
            <i className="ri-image-add-line" />
            <span>{t("upload.image") ?? "이미지"}</span>
          </button>
          {uploading && (
            <div className="flex items-center gap-2">
              <Loading type="spin" color="#FC466B" height={16} width={16} />
              <span className="text-sm text-neutral-500">{t("uploading")}</span>
            </div>
          )}
        </div>
        {mode === "rich" && <RichToolbar />}
      </FlatInset>

      <div
        className="relative bg-w"
        style={{ minHeight: height }}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {mode === "rich" && (
          <EditorContent
            editor={editor}
            className="prose prose-neutral dark:prose-invert max-w-none px-4 py-4 focus:outline-none"
            style={{ minHeight: height }}
          />
        )}
        {(mode === "markdown" || mode === "html") && (
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full resize-none bg-transparent px-4 py-4 font-mono text-sm t-primary focus:outline-none"
            style={{ minHeight: height }}
            placeholder={
              mode === "markdown"
                ? "# 제목\n\n마크다운으로 작성하세요..."
                : "<h1>제목</h1>\n<p>HTML로 작성하세요...</p>"
            }
          />
        )}
      </div>
      <AlertUI />
    </div>
  );
}
