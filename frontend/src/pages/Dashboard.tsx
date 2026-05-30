import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2,
  Package,
  CheckCircle,
  AlertTriangle,
  XCircle,
  DollarSign,
  TrendingUp,
  Box,
  Tag,
} from 'lucide-react';
import { getDashboardStats } from '../api';
import type { DashboardStats } from '../types';

const statMeta = [
  {
    label: 'Total Items',
    icon: Package,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    key: 'total_items' as const,
  },
  {
    label: 'In Stock',
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    key: 'in_stock' as const,
  },
  {
    label: 'Low Stock',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    key: 'low_stock' as const,
  },
  {
    label: 'Out of Stock',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    key: 'out_of_stock' as const,
  },
  {
    label: 'Total Value',
    icon: DollarSign,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    key: 'total_value' as const,
  },
  {
    label: 'Total Cost',
    icon: TrendingUp,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    key: 'total_cost' as const,
  },
  {
    label: 'Inventories',
    icon: Box,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    key: 'inventory_count' as const,
  },
  {
    label: 'Categories',
    icon: Tag,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    key: 'category_count' as const,
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadStats() {
      try {
        const data = await getDashboardStats();
        if (active) {
          setStats(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">
          Overview of your inventory management system
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statMeta.map((stat) => {
            const Icon = stat.icon;
            const value = stats?.[stat.key] ?? 0;
            return (
              <div
                key={stat.label}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:shadow-lg hover:shadow-slate-900/50 transition-shadow duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white mb-1">
                    {stat.key.includes('value') || stat.key.includes('cost')
                      ? formatCurrency(value)
                      : new Intl.NumberFormat('en-US').format(value)}
                  </p>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Shortcuts</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/inventories"
            className="p-4 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
          >
            <Box className="w-5 h-5 mb-2" />
            <span className="text-sm font-medium">Manage Inventories</span>
          </Link>
          <Link
            to="/items"
            className="p-4 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
          >
            <Package className="w-5 h-5 mb-2" />
            <span className="text-sm font-medium">Browse All Items</span>
          </Link>
          <Link
            to="/inventories"
            className="p-4 bg-slate-800 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
          >
            <Tag className="w-5 h-5 mb-2" />
            <span className="text-sm font-medium">Manage Categories</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
