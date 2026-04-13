import { useState } from 'react';
import { useContactStore } from '../store/contactStore';
import { ShieldX, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ExcludeModal({ open, onClose }: Props) {
  const { excludeList, setExcludeList } = useContactStore();
  const [raw, setRaw] = useState(excludeList.map((u) => '@' + u).join('\n'));

  if (!open) return null;

  const handleApply = () => {
    setExcludeList(raw);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-[440px] max-h-[70vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <ShieldX size={16} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Чёрный список</h2>
              <p className="text-[11px] text-gray-500">Эти ники будут мгновенно удалены из базы</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-auto">
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={"@username1\n@username2\n@spambot\n\nПо одному на строку или через запятую"}
            className="w-full h-48 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-gray-600 outline-none focus:border-red-500/30 resize-none font-mono"
          />
          <p className="text-[11px] text-gray-600 mt-2">
            Текущий чёрный список: <span className="text-red-400">{excludeList.length}</span> ников
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-end gap-2.5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            Отмена
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-red-500 text-white hover:bg-red-400 transition-colors"
          >
            <ShieldX size={13} />
            Применить
          </button>
        </div>
      </div>
    </div>
  );
}
