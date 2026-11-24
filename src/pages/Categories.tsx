import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import api, { getApiErrorMessage } from '../api/axios';
import { CATEGORY_ICONS, CategoryIcon } from '../components/CategoryIcon';
import Layout from '../components/Layout';
import type { Category, CategoryType } from '../types';

const CATEGORY_COLORS = [
  '#059669',
  '#0D9488',
  '#2563EB',
  '#4F46E5',
  '#7C3AED',
  '#DB2777',
  '#DC2626',
  '#D97706',
  '#0284C7',
  '#475569',
];

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>('EXPENSE');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState('Tag');
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ categories: Category[] }>('/categories');
      setCategories(res.data.categories);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load categories.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const openCreate = (defaultType: CategoryType = 'EXPENSE') => {
    setEditingCat(null);
    setName('');
    setType(defaultType);
    setColor(defaultType === 'INCOME' ? '#059669' : '#4F46E5');
    setIcon('Tag');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    setType(cat.type);
    setColor(cat.color);
    setIcon(cat.icon || 'Tag');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingCat) {
        await api.put(`/categories/${editingCat.id}`, {
          name: name.trim(),
          color,
          icon,
        });
      } else {
        await api.post('/categories', {
          name: name.trim(),
          type,
          color,
          icon,
        });
      }
      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save category.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    setError(null);
    try {
      await api.delete(`/categories/${cat.id}`);
      await loadCategories();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to delete category.'));
    }
  };

  const expenseCategories = categories.filter((c) => c.type === 'EXPENSE');
  const incomeCategories = categories.filter((c) => c.type === 'INCOME');

  const renderGroup = (title: string, items: Category[], groupType: CategoryType) => (
    <div className="bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {items.length} active categor{items.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate(groupType)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/25 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add {groupType === 'INCOME' ? 'Income' : 'Expense'}</span>
        </button>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {items.map((cat) => {
          const txCount = cat._count?.transactions ?? 0;
          return (
            <div
              key={cat.id}
              className="py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${cat.color}20`,
                    color: cat.color,
                  }}
                >
                  <CategoryIcon name={cat.icon} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {txCount} transaction{txCount === 1 ? '' : 's'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(cat)}
                  aria-label={`Edit ${cat.name}`}
                  className="p-2 text-slate-400 hover:text-indigo-500 rounded-lg cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(cat)}
                  disabled={txCount > 0}
                  title={
                    txCount > 0
                      ? `In use by ${txCount} transaction(s)`
                      : `Delete ${cat.name}`
                  }
                  aria-label={`Delete ${cat.name}`}
                  className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <Layout
      title="Categories"
      subtitle="Organize custom income and expense categories with icons and colors"
      headerAction={
        <button
          type="button"
          onClick={() => openCreate('EXPENSE')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-600/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Category</span>
        </button>
      }
    >
      <div className="space-y-6">
        {error && (
          <div
            role="alert"
            className="px-4 py-3 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl"
          >
            {error}
          </div>
        )}

        {loading && categories.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading categories...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderGroup('Expense Categories', expenseCategories, 'EXPENSE')}
            {renderGroup('Income Categories', incomeCategories, 'INCOME')}
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-white dark:bg-[#111114] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingCat ? 'Edit Category' : 'New Category'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editingCat && (
                <div>
                  <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Category Type
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {(['EXPENSE', 'INCOME'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`py-2 text-xs font-semibold rounded-lg cursor-pointer ${
                          type === t
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {t === 'EXPENSE' ? 'Expense' : 'Income'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Subscriptions"
                  required
                  className="w-full px-3.5 py-2.5 text-sm text-slate-900 dark:text-white bg-white dark:bg-[#09090B] border border-slate-300 dark:border-white/[0.1] rounded-xl"
                />
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Icon
                </span>
                <div className="grid grid-cols-8 gap-2">
                  {CATEGORY_ICONS.map((item) => {
                    const Icon = item.component;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setIcon(item.name)}
                        className={`p-2 rounded-lg flex items-center justify-center border cursor-pointer ${
                          icon === item.name
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Color
                </span>
                <div className="flex flex-wrap items-center gap-2.5">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-lg cursor-pointer ${
                        color.toUpperCase() === c
                          ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110'
                          : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value.toUpperCase())}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl cursor-pointer"
                >
                  {saving ? 'Saving...' : editingCat ? 'Save Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
