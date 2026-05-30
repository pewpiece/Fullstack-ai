import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Package, Plus, Calendar, Tag, Box, Pencil, Trash2 } from 'lucide-react';
import {
  createInventory,
  deleteInventory,
  getInventories,
  updateInventory,
} from '../api';
import type { Inventory } from '../types';
import { Dialog } from '../components/ui/Dialog';
import { ErrorBanner } from '../components/ui/ErrorBanner';

function formatDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

type InventoryDialogMode = 'create' | 'edit';

export function Inventories() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<InventoryDialogMode>('create');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [activeInventory, setActiveInventory] = useState<Inventory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState('');

  const dialogTitle = useMemo(
    () => (dialogMode === 'create' ? 'Create Inventory' : 'Update Inventory'),
    [dialogMode],
  );

  const loadInventories = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const data = await getInventories();
      setInventories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventories();
  }, [loadInventories]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setActiveInventory(null);
    setName('');
    setDescription('');
    setFieldError('');
    setDialogOpen(true);
  };

  const openEditDialog = (inventory: Inventory) => {
    setDialogMode('edit');
    setActiveInventory(inventory);
    setName(inventory.name);
    setDescription(inventory.description || '');
    setFieldError('');
    setDialogOpen(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFieldError('Name is required.');
      return;
    }

    setFieldError('');
    setSubmitLoading(true);

    try {
      if (dialogMode === 'create') {
        await createInventory(name.trim(), description.trim() || undefined);
      } else if (activeInventory) {
        await updateInventory(activeInventory.id, name.trim(), description.trim() || undefined);
      }

      setDialogOpen(false);
      await loadInventories();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Failed to save inventory');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (inventory: Inventory) => {
    const approved = window.confirm(`Delete inventory "${inventory.name}"?`);
    if (!approved) {
      return;
    }

    try {
      await deleteInventory(inventory.id);
      await loadInventories();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inventory');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Inventories</h1>
          <p className="text-slate-400">Manage your inventory locations</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          onClick={openCreateDialog}
        >
          <Plus size={20} />
          New Inventory
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : inventories.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
          No inventories found. Create one to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {inventories.map((inventory) => (
            <div
              key={inventory.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:shadow-lg hover:shadow-slate-900/50 transition-shadow duration-200"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-400/10 rounded-lg">
                  <Package className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditDialog(inventory)}
                    className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label={`Edit ${inventory.name}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(inventory)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    aria-label={`Delete ${inventory.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{inventory.name}</h3>
              <p className="text-sm text-slate-400 mb-4 min-h-10">{inventory.description || 'No description'}</p>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1 text-slate-500">
                  <Tag size={16} />
                  <span>{inventory.category_count} categories</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <Box size={16} />
                  <span>{inventory.item_count} items</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  Created {formatDate(inventory.created_at)}
                </span>
                <Link
                  to={`/inventories/${inventory.id}`}
                  className="text-indigo-400 hover:text-indigo-300"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        title={dialogTitle}
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
              form="inventory-form"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white disabled:bg-slate-700"
              disabled={submitLoading}
            >
              {submitLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-4">
          <ErrorBanner message={fieldError} />
          <div>
            <label htmlFor="inventory-name" className="block text-sm font-medium text-slate-300 mb-2">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="inventory-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Main Warehouse"
              required
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="inventory-description" className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              id="inventory-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe this inventory"
              rows={3}
              maxLength={300}
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
