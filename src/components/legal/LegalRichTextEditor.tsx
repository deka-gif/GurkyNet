import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link2,
  Quote,
  Code,
  Image as ImageIcon,
  Table,
  Undo2,
  Redo2,
} from 'lucide-react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
};

const btn =
  'inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-600 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-40 disabled:pointer-events-none transition-colors';

/**
 * Lightweight rich-text editor for Marketing Legal Center (Sprint 7.3).
 * Stores HTML compatible with public Legal Center prose renderer.
 */
export const LegalRichTextEditor: React.FC<Props> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Tulis konten dokumen…',
  minHeight = 360,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [htmlSource, setHtmlSource] = useState(value);

  useEffect(() => {
    if (mode === 'visual' && ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
    }
    setHtmlSource(value || '');
  }, [value, mode]);

  const emit = () => {
    if (!ref.current) return;
    onChange(ref.current.innerHTML);
  };

  const exec = (command: string, arg?: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const insertHtml = (html: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand('insertHTML', false, html);
    emit();
  };

  const wrapLink = () => {
    const url = window.prompt('URL tautan:', 'https://');
    if (!url) return;
    exec('createLink', url);
  };

  const insertImage = () => {
    const url = window.prompt('URL gambar:', 'https://');
    if (!url) return;
    insertHtml(`<p><img src="${url}" alt="" /></p>`);
  };

  const insertTable = () => {
    insertHtml(
      '<table><thead><tr><th>Kolom 1</th><th>Kolom 2</th></tr></thead><tbody><tr><td>—</td><td>—</td></tr></tbody></table>'
    );
  };

  const insertVideo = () => {
    const url = window.prompt('URL embed video (YouTube/Vimeo iframe src):', 'https://');
    if (!url) return;
    insertHtml(
      `<div class="legal-video"><iframe src="${url}" title="Video" allowfullscreen loading="lazy"></iframe></div>`
    );
  };

  const switchMode = (next: 'visual' | 'html') => {
    if (next === 'html' && ref.current) {
      setHtmlSource(ref.current.innerHTML);
    }
    if (next === 'visual') {
      onChange(htmlSource);
    }
    setMode(next);
  };

  const toolbar = useMemo(
    () => [
      { icon: Bold, title: 'Bold', action: () => exec('bold') },
      { icon: Italic, title: 'Italic', action: () => exec('italic') },
      { icon: Underline, title: 'Underline', action: () => exec('underline') },
      { icon: Heading2, title: 'Heading 2', action: () => exec('formatBlock', 'h2') },
      { icon: Heading3, title: 'Heading 3', action: () => exec('formatBlock', 'h3') },
      { icon: List, title: 'Bullet list', action: () => exec('insertUnorderedList') },
      { icon: ListOrdered, title: 'Numbered list', action: () => exec('insertOrderedList') },
      { icon: Quote, title: 'Quote', action: () => exec('formatBlock', 'blockquote') },
      { icon: Code, title: 'Code', action: () => exec('formatBlock', 'pre') },
      { icon: Link2, title: 'Link', action: wrapLink },
      { icon: ImageIcon, title: 'Image', action: insertImage },
      { icon: Table, title: 'Table', action: insertTable },
      { icon: Undo2, title: 'Undo', action: () => exec('undo') },
      { icon: Redo2, title: 'Redo', action: () => exec('redo') },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled]
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
        {toolbar.map((item) => (
          <button
            key={item.title}
            type="button"
            title={item.title}
            disabled={disabled || mode === 'html'}
            onClick={item.action}
            className={btn}
          >
            <item.icon className="w-4 h-4" />
          </button>
        ))}
        <button
          type="button"
          title="Embed video"
          disabled={disabled || mode === 'html'}
          onClick={insertVideo}
          className={`${btn} text-xs font-semibold px-2 w-auto`}
        >
          Video
        </button>
        <div className="ml-auto flex items-center gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => switchMode('visual')}
            className={`px-2.5 py-1 rounded-lg ${mode === 'visual' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-white'}`}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={() => switchMode('html')}
            className={`px-2.5 py-1 rounded-lg ${mode === 'html' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-white'}`}
          >
            HTML
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <div
          ref={ref}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          data-placeholder={placeholder}
          className="legal-editor-surface px-5 py-4 outline-none text-gray-800 leading-[1.8] prose prose-slate max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
          style={{ minHeight }}
        />
      ) : (
        <textarea
          value={htmlSource}
          disabled={disabled}
          onChange={(e) => {
            setHtmlSource(e.target.value);
            onChange(e.target.value);
          }}
          className="w-full px-4 py-3 font-mono text-sm text-gray-800 outline-none resize-y bg-slate-50"
          style={{ minHeight }}
        />
      )}
    </div>
  );
};
