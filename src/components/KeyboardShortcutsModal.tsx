import { Keyboard, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'General Workspace',
    items: [
      { keys: ['Ctrl / ⌘', 'K'], description: 'Open Quick Jump command palette' },
      { keys: ['?'], description: 'Show or hide Keyboard Shortcuts guide' },
      { keys: ['Esc'], description: 'Close active dialog, drawer, or popover' },
    ],
  },
  {
    title: 'Navigation Chords (Press G, then key)',
    items: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'W'], description: 'Go to Cash / Bank & Wallets' },
      { keys: ['G', 'L'], description: 'Go to Account Ledger' },
      { keys: ['G', 'E'], description: 'Go to Expenses & Entries' },
      { keys: ['G', 'B'], description: 'Go to Monthly Budgets' },
      { keys: ['G', 'M'], description: 'Open User Manual' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
    ],
  },
  {
    title: 'Accounting Views (Press G, then key)',
    items: [
      { keys: ['G', 'C'], description: 'Open Chart of Accounts' },
      { keys: ['G', 'P'], description: 'Open Profit & Loss Statement' },
      { keys: ['G', 'T'], description: 'Open Trial Balance' },
    ],
  },
];

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                  <Keyboard className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Keyboard Shortcuts
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Navigate Multi-Wallet without touching your mouse
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close shortcuts guide"
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2.5">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                    {group.title}
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-white/[0.06] border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
                    {group.items.map((item) => (
                      <div
                        key={item.description}
                        className="flex items-center justify-between gap-4 px-3.5 py-2.5 bg-slate-50/50 dark:bg-white/[0.02]"
                      >
                        <span className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                          {item.description}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, idx) => (
                            <span key={`${k}-${idx}`} className="inline-flex items-center gap-1">
                              {idx > 0 && (
                                <span className="text-[10px] text-slate-400">then</span>
                              )}
                              <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-700 dark:text-zinc-200 bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.15] rounded-md shadow-2xs">
                                {k}
                              </kbd>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
