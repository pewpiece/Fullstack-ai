import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loader2, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  createItem,
  deleteItem,
  getCategories,
  getInventory,
  getItems,
  updateItem,
} from '../api';
import type { Category, Inventory, Item, ItemCreate, ItemUpdate } from '../types';
import { Dialog } from '../components/ui/Dialog';
import { ErrorBanner } from '../components/ui/ErrorBanner';

type ItemStatus = Item['status'];
type ItemDialogMode = 'create' | 'edit';

interface ItemFormState {
  name: string;
  sku: string;
  category_id: string;
  quantity: string;
  min_stock: string;
  price: string;
  cost: string;
  supplier: string;
  unit: string;
  status: ItemStatus;
  image: string;
}

const statusConfig: Record<ItemStatus, { label: string; className: string }> = {
  'in-stock': { label: 'In Stock', className: 'bg-emerald-400/10 text-emerald-400' },
  'low-stock': { label: 'Low Stock', className: 'bg-amber-400/10 text-amber-400' },
  'out-of-stock': { label: 'Out of Stock', className: 'bg-red-400/10 text-red-400' },
};

function formatDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function emptyForm(categoryId = ''): ItemFormState {
  return {
    name: '',
    sku: '',
    category_id: categoryId,
    quantity: '0',
    min_stock: '0',
    price: '0',
    cost: '0',
    supplier: '',
    unit: 'pieces',
    status: 'in-stock',
    image: '',
  };
}

function toPayload(form: ItemFormState): ItemCreate {
  return {
    name: form.name.trim(),
    sku: form.sku.trim(),
    category_id: form.category_id,
    quantity: Number(form.quantity),
    min_stock: Number(form.min_stock),
    price: Number(form.price),
    cost: Number(form.cost),
    supplier: form.supplier.trim() || undefined,
    unit: form.unit.trim(),
    status: form.status,
    image: form.image.trim() || undefined,
  };
}

function fromItem(item: Item): ItemFormState {
  return {
    name: item.name,
    sku: item.sku,
    category_id: item.category_id,
    quantity: String(item.quantity),
    min_stock: String(item.min_stock),
    price: String(item.price),
    cost: String(item.cost),
    supplier: item.supplier || '',
    unit: item.unit,
    status: item.status,
    image: item.image || '',
  };
}

export function CategoryItems() {
  const { invId, catId } = useParams<{ invId: string; catId: string }>();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<ItemDialogMode>('create');
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [form, setForm] = useState<ItemFormState>(emptyForm());
  const [fieldError, setFieldError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const dialogTitle = useMemo(
    () => (dialogMode === 'create' ? 'Add Item' : 'Update Item'),
    [dialogMode],
  );

  const loadData = useCallback(async () => {
    if (!invId || !catId) {
      return;
    }

    try {
      setError('');
      setLoading(true);
      const [inventoryData, categoriesData, itemsData] = await Promise.all([
        getInventory(invId),
        getCategories(invId),
        getItems({ cat_id: catId }),
      ]);

      setInventory(inventoryData);
      setCategories(categoriesData);
      setCategory(categoriesData.find((entry) => entry.id === catId) || null);
      setItems(itemsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load category items');
    } finally {
      setLoading(false);
    }
  }, [invId, catId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreateDialog = () => {
    setDialogMode('create');
    setActiveItem(null);
    setForm(emptyForm(catId || ''));
    setFieldError('');
    setDialogOpen(true);
  };

  const openEditDialog = (item: Item) => {
    setDialogMode('edit');
    setActiveItem(item);
    setForm(fromItem(item));
    setFieldError('');
    setDialogOpen(true);
  };

  const handleFormChange = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.name.trim() || !form.sku.trim() || !form.category_id || !form.unit.trim()) {
      setFieldError('Name, SKU, category, and unit are required.');
      return;
    }

    const payload = toPayload(form);
    if (Number.isNaN(payload.quantity) || Number.isNaN(payload.min_stock) || Number.isNaN(payload.price) || Number.isNaN(payload.cost)) {
      setFieldError('Quantity, min stock, price, and cost must be valid numbers.');
      return;
    }

    setFieldError('');
    setSubmitLoading(true);

    try {
      if (dialogMode === 'create') {
        await createItem(payload);
      } else if (activeItem) {
        await updateItem(activeItem.id, payload as ItemUpdate);
      }

      setDialogOpen(false);
      await loadData();
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (item: Item) => {
    const approved = window.confirm(`Delete item "${item.name}"?`);
    if (!approved) {
      return;
    }

    try {
      await deleteItem(item.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-sm text-slate-400 flex-wrap">
        <Link to="/inventories" className="hover:text-white transition-colors">
          Inventories
        </Link>
        <ChevronRight size={16} />
        <Link to={`/inventories/${invId || ''}`} className="hover:text-white transition-colors">
          {inventory?.name || 'Inventory'}
        </Link>
        <ChevronRight size={16} />
        <span className="text-white">{category?.name || 'Category'}</span>
      </nav>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">{category?.name || 'Category'}</h1>
          <p className="text-slate-400">{items.length} items in this category</p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
          No items found in this category.
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Name</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">SKU</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Quantity</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Min Stock</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Price</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Cost</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">Last Updated</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = statusConfig[item.status];

                  return (
                    <tr key={item.id} className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-white">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">{item.sku}</td>
                      <td className="px-6 py-4 text-sm text-right text-white">{item.quantity}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-400">{item.min_stock}</td>
                      <td className="px-6 py-4 text-sm text-right text-white">${item.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right text-slate-400">${item.cost.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(item.last_updated)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditDialog(item)}
                            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            aria-label={`Edit ${item.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                            aria-label={`Delete ${item.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              form="item-form"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white disabled:bg-slate-700"
              disabled={submitLoading}
            >
              {submitLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="item-form" onSubmit={handleSubmit} className="space-y-4">
          <ErrorBanner message={fieldError} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-name" className="block text-sm font-medium text-slate-300 mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="item-name"
                type="text"
                value={form.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Item name"
                required
              />
            </div>
            <div>
              <label htmlFor="item-sku" className="block text-sm font-medium text-slate-300 mb-2">
                SKU <span className="text-red-400">*</span>
              </label>
              <input
                id="item-sku"
                type="text"
                value={form.sku}
                onChange={(event) => handleFormChange('sku', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="SKU-1001"
                required
              />
            </div>
            <div>
              <label htmlFor="item-category" className="block text-sm font-medium text-slate-300 mb-2">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                id="item-category"
                value={form.category_id}
                onChange={(event) => handleFormChange('category_id', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Select category</option>
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="item-unit" className="block text-sm font-medium text-slate-300 mb-2">
                Unit <span className="text-red-400">*</span>
              </label>
              <input
                id="item-unit"
                type="text"
                value={form.unit}
                onChange={(event) => handleFormChange('unit', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="pieces"
                required
              />
            </div>
            <div>
              <label htmlFor="item-quantity" className="block text-sm font-medium text-slate-300 mb-2">Quantity</label>
              <input
                id="item-quantity"
                type="number"
                value={form.quantity}
                onChange={(event) => handleFormChange('quantity', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min={0}
                required
              />
            </div>
            <div>
              <label htmlFor="item-min-stock" className="block text-sm font-medium text-slate-300 mb-2">Min Stock</label>
              <input
                id="item-min-stock"
                type="number"
                value={form.min_stock}
                onChange={(event) => handleFormChange('min_stock', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min={0}
                required
              />
            </div>
            <div>
              <label htmlFor="item-price" className="block text-sm font-medium text-slate-300 mb-2">Price</label>
              <input
                id="item-price"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(event) => handleFormChange('price', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min={0}
                required
              />
            </div>
            <div>
              <label htmlFor="item-cost" className="block text-sm font-medium text-slate-300 mb-2">Cost</label>
              <input
                id="item-cost"
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(event) => handleFormChange('cost', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min={0}
                required
              />
            </div>
            <div>
              <label htmlFor="item-status" className="block text-sm font-medium text-slate-300 mb-2">Status</label>
              <select
                id="item-status"
                value={form.status}
                onChange={(event) => handleFormChange('status', event.target.value as ItemStatus)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>
            <div>
              <label htmlFor="item-supplier" className="block text-sm font-medium text-slate-300 mb-2">Supplier</label>
              <input
                id="item-supplier"
                type="text"
                value={form.supplier}
                onChange={(event) => handleFormChange('supplier', event.target.value)}
                className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Supplier name"
              />
            </div>
          </div>
          <div>
            <label htmlFor="item-image" className="block text-sm font-medium text-slate-300 mb-2">Image URL</label>
            <input
              id="item-image"
              type="url"
              value={form.image}
              onChange={(event) => handleFormChange('image', event.target.value)}
              className="block w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://example.com/image.jpg"
            />
          </div>
        </form>
      </Dialog>
    </div>
  );
}
