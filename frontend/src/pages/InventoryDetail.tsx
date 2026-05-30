import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, Tag, Package, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  createCategory,
  deleteCategory,
  getCategories,
  getInventory,
  updateCategory,
} from '../api';
import type { Category, Inventory } from '../types';
import { Dialog } from '../components/ui/Dialog';
import { ErrorBanner } from '../components/ui/ErrorBanner';

function formatDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

type CategoryDialogMode = 'create' | 'edit';

export function InventoryDetail() {
  const { invId } = useParams<{ invId: string }>();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<CategoryDialogMode>('create');
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [fieldError, setFieldError] = useState('');

  const loadInventory = useCallback(async () => {
    if (!invId) {
      return;
    }

    try {
      setError('');
      setLoading(true);
      const [inventoryData, categoriesData] = await Promise.all([
        getInventory(invId),
        getCategories(invId),
      ]);
      setInventory(inventoryData);
      setCategories(categoriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [invId]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setActiveCategory(null);
    setName('');
    setDescription('');
    setFieldError('');
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setDialogMode('edit');
    setActiveCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setFieldError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!invId) {
      return;
    }
    if (!name.trim()) {
      setFieldError('Name is required.');
      return;
    }

    setSubmitLoading(true);
    setFieldError('');

    try {
      if (dialogMode === 'create') {
        await createCategory(invId, name.trim(), description.trim() || undefined);
      } else if (activeCategory) {
        await updateCategory(invId, activeCategory.id, name.trim(), description.trim() || undefined);
      }
      setDialogOpen(false);
      await loadInventory();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!invId) {
      return;
    }

    const approved = window.confirm(`Delete category "${category.name}"?`);
    if (!approved) {
      return;
    }

    try {
      await deleteCategory(invId, category.id);
      await loadInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link to="/inventories" className="hover:text-white transition-colors">
          Inventories
        </Link>
        <ChevronRight size={16} />
        <span className="text-white">{inventory?.name || 'Inventory'}</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {inventory?.name || 'Inventory'}
          </h1>
          <p className="text-slate-400">Manage categories in this inventory</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          onClick={openCreateDialog}
        >
          <Plus size={20} />
          New Category
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
          No categories found. Add one to start tracking items.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:shadow-lg hover:shadow-slate-900/50 transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-cyan-400/10 rounded-lg">
                  <Tag className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditDialog(category)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label={`Edit ${category.name}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(category)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{category.name}</h3>
              <p className="text-sm text-slate-400 mb-4 min-h-10">
                {category.description || 'No description'}
              </p>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Package size={16} />
                  {category.item_count} items
                </span>
                <Link to={`/inventories/${invId}/${category.id}`} className="text-indigo-400 hover:text-indigo-300">
                  Open
                </Link>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500">
                Created {formatDate(category.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        title={dialogMode === 'create' ? 'Create Category' : 'Update Category'}
        onClose={() => setDialogOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="px-4 py-2 text-slate-300 hover:text-white"
              disabled={submitLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="category-form"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white disabled:bg-slate-700"
              disabled={submitLoading}
            >
              {submitLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          <ErrorBanner message={fieldError} />
          <div>
            <label htmlFor="category-name" className="block text-sm font-medium text-slate-300 mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="category-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Electronics"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="category-description" className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe this category"
              rows={3}
              maxLength={300}
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
