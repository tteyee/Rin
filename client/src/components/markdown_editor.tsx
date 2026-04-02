import Editor from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Loading from 'react-loading';
import { FlatInset, FlatTabButton } from "@rin/ui";
import { useAlert } from "./dialog";
import { useColorMode } from "../utils/darkModeUtils";
import { buildMarkdownImage, uploadImageFile } from "../utils/image-upload";
import { Markdown } from "./markdown";

// ─── Editor mode type ────────────────────────────────────────────────────────
type EditorMode = 'markdown' | 'html' | 'wysiwyg';

interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
}

// ─── Simple WYSIWYG toolbar ───────────────────────────────────────────────────
function WysiwygToolbar({ onAction }: { onAction: (tag: string) => void }) {
  const tools = [
    { icon: 'ri-bold', label: 'Bold', md: '**bold**', action: 'bold' },
    { icon: 'ri-italic', label: 'Italic', md: '*italic*', action: 'italic' },
    { icon: 'ri-h-1', label: 'H1', action: 'h1' },
    { icon: 'ri-h-2', label: 'H2', action: 'h2' },
    { icon: 'ri-h-3', label: 'H3', action: 'h3' },
    { icon: 'ri-list-unordered', label: 'List', action: 'ul' },
    { icon: 'ri-list-ordered', label: 'Ordered List', action: 'ol' },
    { icon: 'ri-link', label: 'Link', action: 'link' },
    { icon: 'ri-code-line', label: 'Inline Code', action: 'code' },
    { icon: 'ri-code-block', label: 'Code Block', action: 'codeblock' },
    { icon: 'ri-double-quotes-l', label: 'Blockquote', action: 'quote' },
    { icon: 'ri-separator', label: 'Horizontal Rule', action: 'hr' },
  ];

  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-black/10 dark:border-white/10 bg-secondary/50">
      {tools.map((t) => (
        <button
          key={t.action}
          type="button"
          title={t.label}
          onClick={() => onAction(t.action)}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-sm t-primary hover:bg-theme/10 hover:text-theme transition-colors"
        >
          <i className={t.icon} />
        </button>
      ))}
    </div>
  );
}

export function MarkdownEditor({ content, setContent, placeholder = "> Write your content here...", height = "400px" }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const isComposingRef = useRef(false);
  const [preview, setPreview] = useState<'edit' | 'preview' | 'comparison'>('edit');
  const [editorMode, setEditorMode] = useState<EditorMode>('markdown');
  const [uploading, setUploading] = useState(false);
  const { showAlert, AlertUI } = useAlert();

  async function insertImage(
    file: File,
    range: NonNullable<ReturnType<editor.IStandaloneCodeEditor["getSelection"]>>,
    showAlert: (msg: string) => void,
  ) {
    try {
      const result = await uploadImageFile(file);
      const editorInstance = editorRef.current;
      if (!editorInstance) return;
      editorInstance.executeEdits(undefined, [{
        range,
        text: buildMarkdownImage(file.name, result.url, {
          blurhash: result.blurhash,
          width: result.width,
          height: result.height,
        }),
      }]);
    } catch (error) {
      console.error(error);
      showAlert(error instanceof Error ? error.message : t("upload.failed"));
    }
  }

  const handlePaste = async (event: React.ClipboardEvent<HTMLDivElement>) => {
    const clipboardData = event.clipboardData;
    if (clipboardData.files.length === 1) {
      const editor = editorRef.current;
      if (!editor) return;
      editor.trigger(undefined, "undo", undefined);
      setUploading(true);
      const myfile = clipboardData.files[0] as File;
      const selection = editor.getSelection();
      if (!selection) {
        setUploading(false);
        return;
      }
      void insertImage(myfile, selection, showAlert).finally(() => {
        setUploading(false);
      });
    }
  };

  // ─── WYSIWYG toolbar action handler ──────────────────────────────────────
  function handleWysiwygAction(action: string) {
    const ed = editorRef.current;
    if (!ed) return;
    const selection = ed.getSelection();
    const selectedText = selection ? ed.getModel()?.getValueInRange(selection) ?? '' : '';

    const snippets: Record<string, string> = {
      bold: `**${selectedText || 'bold text'}**`,
      italic: `*${selectedText || 'italic text'}*`,
      h1: `\n# ${selectedText || 'Heading 1'}\n`,
      h2: `\n## ${selectedText || 'Heading 2'}\n`,
      h3: `\n### ${selectedText || 'Heading 3'}\n`,
      ul: `\n- ${selectedText || 'List item'}\n`,
      ol: `\n1. ${selectedText || 'List item'}\n`,
      link: `[${selectedText || 'link text'}](url)`,
      code: `\`${selectedText || 'code'}\``,
      codeblock: `\n\`\`\`\n${selectedText || 'code here'}\n\`\`\`\n`,
      quote: `\n> ${selectedText || 'blockquote'}\n`,
      hr: '\n---\n',
    };

    const snippet = snippets[action];
    if (snippet && selection) {
      ed.executeEdits(undefined, [{ range: selection, text: snippet }]);
      ed.focus();
    }
  }

  function UploadImageButton() {
    const uploadRef = useRef<HTMLInputElement>(null);
    
    const upChange = (event: any) => {
      for (let i = 0; i < event.currentTarget.files.length; i++) {
        const file = event.currentTarget.files[i];
        if (file.size > 5 * 1024000) {
          showAlert(t("upload.failed$size", { size: 5 }));
          uploadRef.current!.value = "";
        } else {
          const editor = editorRef.current;
          if (!editor) return;
          const selection = editor.getSelection();
          if (!selection) return;
          setUploading(true);
          void insertImage(file, selection, showAlert).finally(() => {
            setUploading(false);
          });
        }
      }
    };
    
    return (
      <button
        type="button"
        onClick={() => uploadRef.current?.click()}
        className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
      >
        <input
          ref={uploadRef}
          onChange={upChange}
          className="hidden"
          type="file"
          accept="image/gif,image/jpeg,image/jpg,image/png"
        />
        <i className="ri-image-add-line" />
        <span>Image</span>
      </button>
    );
  }

  /* ---------------- Monaco Mount & IME Optimization ---------------- */

  const handleEditorMount = (editor: editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    editor.onDidCompositionStart(() => {
      isComposingRef.current = true;
    });

    editor.onDidCompositionEnd(() => {
      isComposingRef.current = false;
      setContent(editor.getValue());
    });

    editor.onDidChangeModelContent(() => {
      if (!isComposingRef.current) {
        setContent(editor.getValue());
      }
    });

    editor.onDidBlurEditorText(() => {
      setContent(editor.getValue());
    });
  };

  /* ---------------- synchronization ---------------- */

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const editorValue = model.getValue();

    if (editorValue !== content) {
      editor.setValue(content);
    }
  }, [content]);

  // Monaco language based on editor mode
  const monacoLanguage = editorMode === 'html' ? 'html' : 'markdown';

  /* ---------------- UI ---------------- */

  return (
    <div className="flex flex-col gap-0 sm:gap-3">
      {/* ── Top toolbar row ── */}
      <FlatInset className="flex flex-wrap items-center gap-2 border-0 border-b border-black/10 rounded-none bg-transparent p-3 dark:border-white/10">
        {/* Editor mode selector */}
        <div className="flex items-center rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
          {(['markdown', 'html', 'wysiwyg'] as EditorMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setEditorMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                editorMode === mode
                  ? 'bg-theme text-white'
                  : 't-primary hover:bg-theme/10'
              }`}
            >
              {mode === 'markdown' ? 'Markdown' : mode === 'html' ? 'HTML' : '기본'}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* Preview mode (only for markdown/wysiwyg) */}
        {editorMode !== 'html' && (
          <>
            <FlatTabButton active={preview === 'edit'} onClick={() => setPreview('edit')}> {t("edit")} </FlatTabButton>
            <FlatTabButton active={preview === 'preview'} onClick={() => setPreview('preview')}> {t("preview")} </FlatTabButton>
            <FlatTabButton active={preview === 'comparison'} onClick={() => setPreview('comparison')}> {t("comparison")} </FlatTabButton>
          </>
        )}

        <div className="flex-grow" />
        <UploadImageButton />
        {uploading &&
          <div className="flex flex-row items-center space-x-2">
            <Loading type="spin" color="#FC466B" height={16} width={16} />
            <span className="text-sm text-neutral-500">{t('uploading')}</span>
          </div>
        }
      </FlatInset>

      {/* ── WYSIWYG toolbar (only in wysiwyg mode) ── */}
      {editorMode === 'wysiwyg' && (
        <WysiwygToolbar onAction={handleWysiwygAction} />
      )}

      {/* ── Editor & Preview area ── */}
      <div className={`grid grid-cols-1 gap-0 sm:gap-4 ${preview === 'comparison' && editorMode !== 'html' ? "lg:grid-cols-2" : ""}`}>
        <div className={"flex min-w-0 flex-col " + (preview === 'preview' && editorMode !== 'html' ? "hidden" : "")}>
          <div
            className={"relative min-h-0 overflow-hidden rounded-none border-0 bg-w"}
            onDrop={(e) => {
              e.preventDefault();
              const editor = editorRef.current;
              if (!editor) return;
              for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const selection = editor.getSelection();
                if (!selection) return;
                const file = e.dataTransfer.files[i];
                setUploading(true);
                void insertImage(file, selection, showAlert).finally(() => {
                  setUploading(false);
                });
              }
            }}
            onPaste={handlePaste}
          >
            <Editor
              onMount={handleEditorMount}
              height={height}
              defaultLanguage={monacoLanguage}
              language={monacoLanguage}
              defaultValue={content}
              theme={colorMode === "dark" ? "vs-dark" : "light"}
              options={{
                wordWrap: "on",
                fontFamily: "Sarasa Mono SC, JetBrains Mono, monospace",
                fontLigatures: false,
                letterSpacing: 0,
                fontSize: 14,
                lineNumbers: editorMode === 'html' ? "on" : "off",
                accessibilitySupport: "off",
                unicodeHighlight: { ambiguousCharacters: false },
                renderWhitespace: "none",
                renderControlCharacters: false,
                smoothScrolling: false,
                dragAndDrop: true,
                pasteAs: { enabled: false },
              }}
            />
          </div>
        </div>

        {/* Preview pane (markdown / wysiwyg only) */}
        {editorMode !== 'html' && (
          <div
            className={"min-h-0 overflow-y-auto rounded-none border-0 bg-w px-4 py-4 border-t sm:border-none " + (preview === 'edit' ? "hidden" : "")}
            style={{ height: height }}
          >
            <Markdown content={content ? content : placeholder} />
          </div>
        )}

        {/* HTML preview pane */}
        {editorMode === 'html' && (
          <div
            className="min-h-0 overflow-y-auto rounded-none bg-w px-4 py-4 border-t border-black/10 dark:border-white/10"
            style={{ height: height }}
          >
            <p className="mb-2 text-xs text-neutral-400">HTML 미리보기</p>
            <div
              className="prose dark:prose-invert max-w-none t-primary"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          </div>
        )}
      </div>
      <AlertUI />
    </div>
  );
}
