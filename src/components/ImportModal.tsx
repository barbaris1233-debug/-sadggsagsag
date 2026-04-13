import { useState, useRef } from 'react';
import { useContactStore } from '../store/contactStore';
import { extractUsernames } from '../utils/parser';
import { Upload, FileText, X, Zap } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImportModal({ open, onClose }: Props) {
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const { importRaw } = useContactStore();

  if (!open) return null;

  const handleTextChange = (text: string) => {
    setRaw(text);
    setPreview(extractUsernames(text));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    handleTextChange(text);
  };

  const handleImport = () => {
    importRaw(raw);
    setRaw('');
    setPreview([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-[520px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Upload size={16} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Импорт контактов</h2>
              <p className="text-[11px] text-gray-500">CSV, текст, ссылки — вставьте всё</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-auto space-y-4">
          <textarea
            value={raw}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={"Вставьте сюда данные...\n\n@username, https://t.me/user, CSV-данные\nВсё автоматически распарсится."}
            className="w-full h-40 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/30 resize-none font-mono"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <FileText size={14} />
              Загрузить файл
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFile} className="hidden" />
            <span className="text-[11px] text-gray-600">.csv, .txt, .tsv</span>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-400">Найдено контактов:</span>
                <span className="text-xs font-bold text-cyan-400">{preview.length}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto">
                {preview.slice(0, 50).map((u) => (
                  <span key={u} className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 text-[11px] rounded-full">
                    @{u}
                  </span>
                ))}
                {preview.length > 50 && (
                  <span className="px-2 py-0.5 bg-white/5 text-gray-500 text-[11px] rounded-full">
                    +{preview.length - 50} ещё
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-end gap-2.5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            Отмена
          </button>
          <button
            onClick={handleImport}
            disabled={preview.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-cyan-500 text-black hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Zap size={13} />
            Импортировать {preview.length > 0 && `(${preview.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
