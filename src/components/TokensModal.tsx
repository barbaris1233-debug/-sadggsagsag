import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, KeyRound, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { useContactStore } from '../store/contactStore';

const TOKEN_RE = /^\d{5,12}:[A-Za-z0-9_-]{35,}$/;

function isValid(t: string) { return TOKEN_RE.test(t.trim()); }

interface Props { open: boolean; onClose: () => void }

export default function TokensModal({ open, onClose }: Props) {
  const botTokens   = useContactStore((s) => s.botTokens);
  const setBotTokens = useContactStore((s) => s.setBotTokens);

  const [draft, setDraft]       = useState<string[]>([]);
  const [input, setInput]       = useState('');
  const [error, setError]       = useState('');

  useEffect(() => { if (open) setDraft([...botTokens]); }, [open, botTokens]);

  const handleAdd = useCallback(() => {
    const t = input.trim();
    if (!isValid(t)) { setError('Неверный формат токена'); return; }
    if (draft.includes(t)) { setError('Токен уже добавлен'); return; }
    setDraft((d) => [...d, t]);
    setInput('');
    setError('');
  }, [input, draft]);

  const handleSave = useCallback(() => {
    const valid = draft.filter(isValid);
    setBotTokens(valid);
    onClose();
  }, [draft, setBotTokens, onClose]);

  if (!open) return null;

  const concurrency = draft.length * 4;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-[480px] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <KeyRound size={16} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Bot Tokens</h2>
              <p className="text-[11px] text-gray-500">Каждый токен = +4 параллельных слота</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Speed indicator */}
        <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl bg-violet-500/5 border border-violet-500/10 flex items-center gap-2">
          <Zap size={13} className="text-violet-400 shrink-0" />
          <span className="text-[11px] text-gray-400">
            {draft.length === 0
              ? <span>Без токенов: режим proxy, <span className="text-white">5</span> параллельно</span>
              : <>
                  <span className="text-violet-400 font-semibold">{draft.length}</span> токен{draft.length > 1 ? 'ов' : ''}{' '}→{' '}
                  <span className="text-emerald-400 font-semibold">{concurrency}</span> параллельных проверок
                </>
            }
          </span>
        </div>

        {/* Token list */}
        <div className="px-5 py-3 space-y-1.5 max-h-64 overflow-y-auto">
          {draft.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-4">Токены не добавлены — работает proxy-режим</p>
          )}
          {draft.map((token, i) => {
            const valid = isValid(token);
            const masked = token.length > 20 ? token.slice(0, 10) + '…' + token.slice(-6) : token;
            return (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] group">
                {valid
                  ? <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                  : <AlertCircle size={13} className="text-red-400 shrink-0" />
                }
                <span className="flex-1 text-xs font-mono text-gray-400 truncate">{masked}</span>
                <button
                  onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                  className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="px-5 pb-3 space-y-1.5">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="123456789:ABCdef… вставьте токен"
              className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-600 outline-none focus:border-violet-500/40 font-mono transition-colors"
              spellCheck={false}
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              className="px-3 py-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus size={15} />
            </button>
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-3 border-t border-white/5 flex items-center justify-between">
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
          >
            Создать токен → @BotFather
          </a>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-violet-500/20 text-violet-400 border border-violet-500/30 hover:bg-violet-500/30 transition-colors cursor-pointer"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
