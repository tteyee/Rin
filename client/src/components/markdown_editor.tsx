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

type EditorMode = 'markdown' | 'html' | 'text';
type PreviewMode = 'edit' | 'preview' | 'comparison';

interface MarkdownEditorProps {
  content: string;
  setContent: (content: string) => void;
  placeholder?: string;
  height?: string;
}

const MODE_LANGUAGE: Record<EditorMode, string> = {
  markdown: 'markdown',
  html: 'html',
  text: 'plaintext',
};

const MODE_LABELS: Record<EditorMode, string> = {
  markdown: 'Markdown',
  html: 'HTML',
  text: 'Text',
};

const MODE_ICONS: Record<EditorMode, string> = {
  markdown: 'ri-markdown-line',
  html: 'ri-code-s-slash-line',
  text: 'ri-text',
};

export function MarkdownEditor({ content, setContent, placeholder = "> Write your content here...", height = "400px" }: MarkdownEditorProps) {
  const { t } = useTranslation();
  const colorMode = useColorMode();
  const editorRef = useRef<editor.IStandaloneCodeEditor>();
  const monacoRef = useRef<any>();
  const isComposingRef = useRef(false);
  const [preview, setPreview] = useState<PreviewMode>('edit');
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
      const ed = editorRef.current;
      if (!ed) return;
      ed.trigger(undefined, "undo", undefined);
      setUploading(true);
      const myfile = clipboardData.files[0] as File;
      const selection = ed.getSelection();
      if (!selection) { setUploading(false); return; }
      void insertImage(myfile, selection, showAlert).finally(() => setUploading(false));
    }
  };

  // 에디터 언어 변경
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    const model = ed.getModel();
    if (!model) return;
    monaco.editor.setModelLanguage(model, MODE_LANGUAGE[editorMode]);
  }, [editorMode]);

  // 툴바 버튼 — 마크다운 서식 삽입
  function insertAround(before: string, after: string = before) {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const selectedText = ed.getModel()?.getValueInRange(sel) ?? '';
    ed.executeEdits(undefined, [{ range: sel, text: `${before}${selectedText}${after}` }]);
    ed.focus();
  }

  function insertLine(prefix: string) {
    const ed = editorRef.current;
    if (!ed) return;
    const pos = ed.getPosition();
    if (!pos) return;
    const line = ed.getModel()?.getLineContent(pos.lineNumber) ?? '';
    const col = 1;
    const endCol = line.length + 1;
    const monaco = monacoRef.current;
    if (!monaco) return;
    ed.executeEdits(undefined, [{
      range: new monaco.Range(pos.lineNumber, col, pos.lineNumber, endCol),
      text: prefix + line.replace(/^#+\s*/, '').replace(/^>\s*/, '').replace(/^-\s*/, ''),
    }]);
    ed.focus();
  }

  function ToolbarButton({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-neutral-200"
      >
        <i className={`${icon} text-base`} />
      </button>
    );
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
          const ed = editorRef.current;
          if (!ed) return;
          const selection = ed.getSelection();
          if (!selection) return;
          setUploading(true);
          void insertImage(file, selection, showAlert).finally(() => setUploading(false));
        }
      }
    };
    return (
      <button
        type="button"
        onClick={() => uploadRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-w px-2.5 py-1.5 text-xs t-primary transition-colors hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
      >
        <input ref={uploadRef} onChange={upChange} className="hidden" type="file" accept="image/gif,image/jpeg,image/jpg,image/png" />
        <i className="ri-image-add-line" />
        <span>{t('upload.title')}</span>
      </button>
    );
  }

  const handleEditorMount = (ed: editor.IStandaloneCodeEditor, monaco: any) => {
    editorRef.current = ed;
    monacoRef.current = monaco;

    ed.onDidCompositionStart(() => { isComposingRef.current = true; });
    ed.onDidCompositionEnd(() => {
      isComposingRef.current = false;
      setContent(ed.getValue());
    });
    ed.onDidChangeModelContent(() => {
      if (!isComposingRef.current) setContent(ed.getValue());
    });
    ed.onDidBlurEditorText(() => { setContent(ed.getValue()); });
  };

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    if (model.getValue() !== content) ed.setValue(content);
  }, [content]);

  const showMarkdownToolbar = editorMode === 'markdown' && preview !== 'preview';
  const showHtmlToolbar = editorMode === 'html' && preview !== 'preview';

  return (
    <div className="flex flex-col gap-0">
      {/* 상단 탭 바 */}
      <FlatInset className="flex flex-wrap items-center gap-1 border-0 border-b border-black/10 rounded-none bg-transparent p-2 dark:border-white/10">
        {/* 미리보기 탭 */}
        <div className="flex items-center gap-1">
          <FlatTabButton active={preview === 'edit'} onClick={() => setPreview('edit')}>{t("edit")}</FlatTabButton>
          <FlatTabButton active={preview === 'preview'} onClick={() => setPreview('preview')}>{t("preview")}</FlatTabButton>
          <FlatTabButton active={preview === 'comparison'} onClick={() => setPreview('comparison')}>{t("comparison")}</FlatTabButton>
        </div>

        <div className="mx-1 h-5 w-px bg-black/10 dark:bg-white/10" />

        {/* 에디터 모드 전환 */}
        <div className="flex items-center gap-1">
          {(Object.keys(MODE_LABELS) as EditorMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setEditorMode(mode)}
              title={MODE_LABELS[mode]}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                editorMode === mode
                  ? 'bg-theme/10 text-theme'
                  : 't-primary hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <i className={MODE_ICONS[mode]} />
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>

        <div className="flex-grow" />

        {/* 이미지 업로드 & 업로드 중 표시 */}
        <UploadImageButton />
        {uploading && (
          <div className="flex flex-row items-center gap-2">
            <Loading type="spin" color="#FC466B" height={14} width={14} />
            <span className="text-xs text-neutral-500">{t('uploading')}</span>
          </div>
        )}
      </FlatInset>

      {/* 마크다운 서식 툴바 */}
      {showMarkdownToolbar && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-black/5 bg-secondary/50 px-3 py-1.5 dark:border-white/5">
          <ToolbarButton icon="ri-bold" title="Bold (Ctrl+B)" onClick={() => insertAround('**')} />
          <ToolbarButton icon="ri-italic" title="Italic (Ctrl+I)" onClick={() => insertAround('*')} />
          <ToolbarButton icon="ri-strikethrough" title="Strikethrough" onClick={() => insertAround('~~')} />
          <ToolbarButton icon="ri-code-line" title="Inline Code" onClick={() => insertAround('`')} />
          <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
          <ToolbarButton icon="ri-h-1" title="Heading 1" onClick={() => insertLine('# ')} />
          <ToolbarButton icon="ri-h-2" title="Heading 2" onClick={() => insertLine('## ')} />
          <ToolbarButton icon="ri-h-3" title="Heading 3" onClick={() => insertLine('### ')} />
          <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
          <ToolbarButton icon="ri-list-unordered" title="Bullet List" onClick={() => insertLine('- ')} />
          <ToolbarButton icon="ri-list-ordered" title="Numbered List" onClick={() => insertLine('1. ')} />
          <ToolbarButton icon="ri-double-quotes-l" title="Blockquote" onClick={() => insertLine('> ')} />
          <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
          <ToolbarButton icon="ri-link" title="Link" onClick={() => insertAround('[', '](url)')} />
          <ToolbarButton icon="ri-separator" title="Horizontal Rule" onClick={() => {
            const ed = editorRef.current;
            if (!ed) return;
            const pos = ed.getPosition();
            if (!pos) return;
            const monaco = monacoRef.current;
            if (!monaco) return;
            ed.executeEdits(undefined, [{
              range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
              text: '\n---\n',
            }]);
            ed.focus();
          }} />
          <ToolbarButton icon="ri-code-box-line" title="Code Block" onClick={() => insertAround('\n```\n', '\n```\n')} />
        </div>
      )}

      {/* HTML 툴바 */}
      {showHtmlToolbar && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-black/5 bg-secondary/50 px-3 py-1.5 dark:border-white/5">
          <ToolbarButton icon="ri-bold" title="<strong>" onClick={() => insertAround('<strong>', '</strong>')} />
          <ToolbarButton icon="ri-italic" title="<em>" onClick={() => insertAround('<em>', '</em>')} />
          <ToolbarButton icon="ri-code-line" title="<code>" onClick={() => insertAround('<code>', '</code>')} />
          <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
          <ToolbarButton icon="ri-h-1" title="<h1>" onClick={() => insertAround('<h1>', '</h1>')} />
          <ToolbarButton icon="ri-h-2" title="<h2>" onClick={() => insertAround('<h2>', '</h2>')} />
          <ToolbarButton icon="ri-h-3" title="<h3>" onClick={() => insertAround('<h3>', '</h3>')} />
          <div className="mx-1 h-4 w-px bg-black/10 dark:bg-white/10" />
          <ToolbarButton icon="ri-link" title="<a>" onClick={() => insertAround('<a href="url">', '</a>')} />
          <ToolbarButton icon="ri-image-line" title="<img>" onClick={() => {
            const ed = editorRef.current;
            if (!ed) return;
            const sel = ed.getSelection();
            if (!sel) return;
            ed.executeEdits(undefined, [{ range: sel, text: '<img src="url" alt="description" />' }]);
            ed.focus();
          }} />
          <ToolbarButton icon="ri-code-box-line" title="<pre><code>" onClick={() => insertAround('<pre><code>', '</code></pre>')} />
          <ToolbarButton icon="ri-paragraph" title="<p>" onClick={() => insertAround('<p>', '</p>')} />
          <ToolbarButton icon="ri-separator" title="<hr>" onClick={() => {
            const ed = editorRef.current;
            if (!ed) return;
            const sel = ed.getSelection();
            if (!sel) return;
            ed.executeEdits(undefined, [{ range: sel, text: '<hr />' }]);
            ed.focus();
          }} />
        </div>
      )}

      {/* 에디터 & 미리보기 */}
      <div className={`grid grid-cols-1 gap-0 sm:gap-4 ${preview === 'comparison' ? "lg:grid-cols-2" : ""}`}>
        <div className={"flex min-w-0 flex-col " + (preview === 'preview' ? "hidden" : "")}>
          <div
            className="relative min-h-0 overflow-hidden rounded-none border-0 bg-w"
            onDrop={(e) => {
              e.preventDefault();
              const ed = editorRef.current;
              if (!ed) return;
              for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const selection = ed.getSelection();
                if (!selection) return;
                const file = e.dataTransfer.files[i];
                setUploading(true);
                void insertImage(file, selection, showAlert).finally(() => setUploading(false));
              }
            }}
            onPaste={handlePaste}
          >
            <Editor
              onMount={handleEditorMount}
              height={height}
              defaultLanguage={MODE_LANGUAGE[editorMode]}
              defaultValue={content}
              theme={colorMode === "dark" ? "vs-dark" : "light"}
              options={{
                wordWrap: "on",
                fontFamily: "Sarasa Mono SC, JetBrains Mono, monospace",
                fontLigatures: false,
                letterSpacing: 0,
                fontSize: 14,
                lineNumbers: editorMode === 'markdown' ? "off" : "on",
                accessibilitySupport: "off",
                unicodeHighlight: { ambiguousCharacters: false },
                renderWhitespace: "none",
                renderControlCharacters: false,
                smoothScrolling: false,
                dragAndDrop: true,
                pasteAs: { enabled: false },
                minimap: { enabled: editorMode !== 'markdown' },
              }}
            />
          </div>
        </div>
        <div
          className={"min-h-0 overflow-y-auto rounded-none border-0 bg-w px-4 py-4 border-t sm:border-none " + (preview === 'edit' ? "hidden" : "")}
          style={{ height }}
        >
          {editorMode === 'html'
            ? <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: content || placeholder }} />
            : <Markdown content={content ? content : placeholder} />
          }
        </div>
      </div>
      <AlertUI />
    </div>
  );
}
