import { useEffect, useState } from 'react';
import { Search, PackageX, Loader2 } from 'lucide-react';
import { getCategories, getInventories, getItems } from '../api';
import type { Category, Inventory, Item } from '../types';

type ItemStatus = Item['status'];

interface EnrichedItem extends Item {
  inventory: string;
  category: string;
}

const statusConfig: Record<ItemStatus, { label: string; className: string }> = {
  'in-stock': { label: 'In Stock', className: 'bg-emerald-400/10 text-emerald-400' },
  'low-stock': { label: 'Low Stock', className: 'bg-amber-400/10 text-amber-400' },
  'out-of-stock': { label: 'Out of Stock', className: 'bg-red-400/10 text-red-400' },
};

function formatDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function AllItems() {
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<EnrichedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    let active = true;

    async function loadItems() {
      try {
        setError('');
        setLoading(true);
        const [itemsData, inventoriesData] = await Promise.all([
          getItems(),
          getInventories(),
        ]);

        const categoriesByInventory = new Map<string, Category[]>();
        await Promise.all(
          inventoriesData.map(async (inventory) => {
            const categories = await getCategories(inventory.id);
            categoriesByInventory.set(inventory.id, categories);
          }),
        );

        const inventoryMap = new Map<string, Inventory>(
          inventoriesData.map((inventory) => [inventory.id, inventory]),
        );
        const categoryMap = new Map<string, { name: string; inventoryId: string }>();
        categoriesByInventory.forEach((categories, inventoryId) => {
          categories.forEach((category) => {
            categoryMap.set(category.id, { name: category.name, inventoryId });
          });
        });

        if (!active) {
          return;
        }

        setItems(
          itemsData.map((item) => ({
            ...item,
            inventory:
              inventoryMap.get(categoryMap.get(item.category_id)?.inventoryId || '')
                ?.name || '',
            category: categoryMap.get(item.category_id)?.name || '',
          })),
        );
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load items');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadItems();

    return () => {
      active = false;
    };
  }, []);

  const filteredItems = items.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(start, start + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">All Items</h1>
          <p className="text-slate-400">Browse all items across inventories</p>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full sm:w-80 pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 bg-slate-800 rounded-full mb-4">
              <PackageX className="w-12 h-12 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              No items found
            </h3>
            <p className="text-slate-400 text-center max-w-sm">
              No items match your search criteria. Try adjusting your search terms.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Name
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    SKU
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">
                    Quantity
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">
                    Min Stock
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">
                    Price
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-slate-400">
                    Cost
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Supplier
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Unit
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Last Updated
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Inventory
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-slate-400">
                    Category
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => {
                  const status = statusConfig[item.status];

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-white">
                          {item.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-300 font-mono">
                          {item.sku}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-white">{item.quantity}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-slate-400">
                          {item.min_stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-white">
                          {formatCurrency(item.price)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm text-slate-400">
                          {formatCurrency(item.cost)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-300">
                          {item.supplier || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-400">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-500">
                          {formatDate(item.last_updated)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-300">
                          {item.inventory}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-400">
                          {item.category}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && filteredItems.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-500">
          <div>
            Showing {start + 1}-{Math.min(start + pageSize, filteredItems.length)} of {filteredItems.length} filtered items ({items.length} total)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-slate-400">Page {safePage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
