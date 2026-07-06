import React, { useMemo, useState } from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel, StatusPill } from '../components';

export default function AdminUsersPage() {
  const { state, actions } = useAdmin();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const users = useMemo(() => {
    const q = search.toLowerCase();
    return state.users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.plan.toLowerCase().includes(q);
      const matchesFilter = filter === 'all' || user.status.toLowerCase() === filter;
      return matchesSearch && matchesFilter;
    });
  }, [state.users, search, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">User Directory</h2>
          <p className="text-on-surface-variant mt-1">Search, suspend, promote, and review user accounts.</p>
        </div>
        <div className="flex gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            className="px-4 py-2 rounded-xl border border-outline-variant/30 bg-white/80 dark:bg-surface-container-highest/70 outline-none focus:border-primary"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 rounded-xl border border-outline-variant/30 bg-white/80 dark:bg-surface-container-highest/70 outline-none focus:border-primary"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      <Panel title={`Users (${users.length})`} description="Manage account status and plan assignments.">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[11px] uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/20">
              <tr>
                <th className="py-3 pr-4">User</th>
                <th className="py-3 pr-4">Plan</th>
                <th className="py-3 pr-4">Docs</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-container-low/60">
                  <td className="py-4 pr-4">
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-[11px] text-on-surface-variant">{user.email}</p>
                    </div>
                  </td>
                  <td className="py-4 pr-4 text-sm">{user.plan}</td>
                  <td className="py-4 pr-4 text-sm">{user.documents}</td>
                  <td className="py-4 pr-4">
                    <StatusPill tone={user.status === 'Suspended' ? 'red' : user.status === 'Pending' ? 'orange' : 'green'}>
                      {user.status}
                    </StatusPill>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => actions.toggleUserStatus(user.id)}
                        className="px-3 py-2 rounded-lg border border-outline-variant/30 text-sm hover:bg-surface-container"
                      >
                        {user.status === 'Suspended' ? 'Unsuspend' : 'Suspend'}
                      </button>
                      <button
                        onClick={() => actions.promoteUser(user.id, user.plan === 'Enterprise AI' ? 'Pro Monthly' : 'Enterprise AI')}
                        className="px-3 py-2 rounded-lg border border-primary/20 text-sm text-primary hover:bg-primary/10"
                      >
                        Promote
                      </button>
                      <button
                        onClick={() => actions.deleteUser(user.id)}
                        className="px-3 py-2 rounded-lg border border-error/20 text-sm text-error hover:bg-error/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
