import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

export default function RichTextEditor() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
    ],
    editorProps: {
      attributes: {
        class: 'tiptap focus:outline-none min-h-[170px] max-h-[300px] overflow-y-auto prose dark:prose-invert max-w-none font-sans text-[14px] leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const input = document.getElementById('blog-content');
      if (input) {
        // If editor has only empty paragraph tags, set value to empty string
        const isEmpty = html === '<p></p>' || html === '';
        input.value = isEmpty ? '' : html;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
  });

  // Bidirectional Synchronization: Listen to changes on hidden input
  useEffect(() => {
    const input = document.getElementById('blog-content');
    if (!input || !editor) return;

    const handleInputValueChange = () => {
      const val = input.value || '';
      if (val !== editor.getHTML()) {
        editor.commands.setContent(val);
      }
    };

    // Initial load prefill
    if (input.value && input.value !== editor.getHTML()) {
      editor.commands.setContent(input.value);
    }

    input.addEventListener('change', handleInputValueChange);
    return () => {
      input.removeEventListener('change', handleInputValueChange);
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className="w-full h-48 flex items-center justify-center border border-primary bg-surface animate-pulse">
        <span className="font-label-caps text-[10px] text-zinc-400 tracking-widest">LOADING EDITOR...</span>
      </div>
    );
  }

  // Helper classes for active/inactive toolbar buttons
  const getBtnClass = (isActive) =>
    `p-1.5 flex items-center justify-center transition-all duration-150 select-none ${
      isActive
        ? 'bg-black text-white hover:bg-neutral-800'
        : 'text-zinc-600 hover:text-black hover:bg-zinc-100'
    }`;

  return (
    <div className="w-full flex flex-col rounded-lg overflow-hidden border border-primary bg-white">
      {/* Premium Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-zinc-50 border-b border-primary">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={getBtnClass(editor.isActive('bold'))}
          title="Bold"
        >
          <span className="material-symbols-outlined text-[20px]">format_bold</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={getBtnClass(editor.isActive('italic'))}
          title="Italic"
        >
          <span className="material-symbols-outlined text-[20px]">format_italic</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={getBtnClass(editor.isActive('strike'))}
          title="Strikethrough"
        >
          <span className="material-symbols-outlined text-[20px]">strikethrough_s</span>
        </button>

        <div className="h-6 w-px bg-zinc-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={getBtnClass(editor.isActive('heading', { level: 2 }))}
          title="Heading 2"
        >
          <span className="material-symbols-outlined text-[20px]">format_h2</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={getBtnClass(editor.isActive('heading', { level: 3 }))}
          title="Heading 3"
        >
          <span className="material-symbols-outlined text-[20px]">format_h3</span>
        </button>

        <div className="h-6 w-px bg-zinc-200 mx-1" />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={getBtnClass(editor.isActive('bulletList'))}
          title="Bullet List"
        >
          <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={getBtnClass(editor.isActive('orderedList'))}
          title="Numbered List"
        >
          <span className="material-symbols-outlined text-[20px]">format_list_numbered</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={getBtnClass(editor.isActive('blockquote'))}
          title="Blockquote"
        >
          <span className="material-symbols-outlined text-[20px]">format_quote</span>
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 flex items-center justify-center text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors"
          title="Horizontal Line"
        >
          <span className="material-symbols-outlined text-[20px]">horizontal_rule</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const url = window.prompt('ENTER IMAGE URL:');
            if (url) {
              editor.chain().focus().setImage({ src: url }).run();
            }
          }}
          className="p-1.5 flex items-center justify-center text-zinc-600 hover:text-black hover:bg-zinc-100 transition-colors"
          title="Insert Image"
        >
          <span className="material-symbols-outlined text-[20px]">image</span>
        </button>

        <div className="h-6 w-px bg-zinc-200 mx-1 flex-1 md:flex-none" />

        <button
          type="button"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          className="p-1.5 flex items-center justify-center text-zinc-600 hover:text-black hover:bg-zinc-100 disabled:opacity-40 transition-colors"
          title="Undo"
        >
          <span className="material-symbols-outlined text-[20px]">undo</span>
        </button>

        <button
          type="button"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          className="p-1.5 flex items-center justify-center text-zinc-600 hover:text-black hover:bg-zinc-100 disabled:opacity-40 transition-colors"
          title="Redo"
        >
          <span className="material-symbols-outlined text-[20px]">redo</span>
        </button>
      </div>

      {/* Editor Content Area */}
      <div className="p-3 bg-white min-h-[200px] outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
