'use client';

import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Column<T> {
    key: string;
    header: string;
    render: (item: T) => React.ReactNode;
    sortable?: boolean;
    className?: string;
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    loading?: boolean;
    searchPlaceholder?: string;
    onSearch?: (query: string) => void;
    searchValue?: string;
    totalItems?: number;
    page?: number;
    pageSize?: number;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    actions?: React.ReactNode;
    emptyMessage?: string;
    emptyIcon?: string;
    onRowClick?: (item: T) => void;
    stickyHeader?: boolean;
    selectable?: boolean;
    selectedIds?: Set<string>;
    onSelectChange?: (ids: Set<string>) => void;
    getRowId?: (item: T) => string;
}

export function DataTable<T>({
    data,
    columns,
    loading = false,
    searchPlaceholder = 'Search...',
    onSearch,
    searchValue = '',
    totalItems,
    page = 1,
    pageSize = 25,
    onPageChange,
    onPageSizeChange,
    actions,
    emptyMessage = 'No data found',
    emptyIcon = '📭',
    onRowClick,
    stickyHeader = true,
    selectable = false,
    selectedIds,
    onSelectChange,
    getRowId,
}: DataTableProps<T>) {
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const total = totalItems ?? data.length;
    const totalPages = Math.ceil(total / pageSize);

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const allSelected = useMemo(() => {
        if (!selectable || !getRowId || data.length === 0) return false;
        return data.every((item) => selectedIds?.has(getRowId(item)));
    }, [data, selectedIds, selectable, getRowId]);

    const handleSelectAll = () => {
        if (!onSelectChange || !getRowId) return;
        if (allSelected) {
            onSelectChange(new Set());
        } else {
            const ids = new Set(data.map((item) => getRowId(item)));
            onSelectChange(ids);
        }
    };

    const handleSelectRow = (id: string) => {
        if (!onSelectChange || !selectedIds) return;
        const next = new Set(selectedIds);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        onSelectChange(next);
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-32" />
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4 p-4 border-b border-gray-50">
                        {Array.from({ length: columns.length }).map((_, j) => (
                            <Skeleton key={j} className="h-4 flex-1" />
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {onSearch && (
                        <div className="w-72">
                            <Input
                                placeholder={searchPlaceholder}
                                value={searchValue}
                                onChange={(e) => onSearch(e.target.value)}
                                icon={
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                }
                            />
                        </div>
                    )}
                    {selectable && selectedIds && selectedIds.size > 0 && (
                        <span className="text-sm text-gray-500">
                            {selectedIds.size} selected
                        </span>
                    )}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead className={stickyHeader ? 'sticky top-0 z-10' : ''}>
                        <tr>
                            {selectable && (
                                <th className="w-10 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={handleSelectAll}
                                        className="rounded border-gray-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                                    />
                                </th>
                            )}
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                    className={`${col.className || ''} ${col.sortable ? 'cursor-pointer hover:text-gray-700 select-none' : ''}`}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && sortKey === col.key && (
                                            <svg className={`w-3 h-3 ${sortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (selectable ? 1 : 0)}
                                    className="text-center py-16"
                                >
                                    <div className="flex flex-col items-center gap-3">
                                        <span className="text-4xl">{emptyIcon}</span>
                                        <p className="text-gray-500 text-sm">{emptyMessage}</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            data.map((item, idx) => {
                                const rowId = getRowId ? getRowId(item) : String(idx);
                                return (
                                    <tr
                                        key={rowId}
                                        onClick={() => onRowClick?.(item)}
                                        className={`
                      ${onRowClick ? 'cursor-pointer' : ''}
                      ${selectable && selectedIds?.has(rowId) ? 'bg-blue-50/50' : ''}
                    `}
                                    >
                                        {selectable && (
                                            <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds?.has(rowId) || false}
                                                    onChange={() => handleSelectRow(rowId)}
                                                    className="rounded border-gray-300 text-[#1E3A5F] focus:ring-[#1E3A5F]"
                                                />
                                            </td>
                                        )}
                                        {columns.map((col) => (
                                            <td key={col.key} className={col.className}>
                                                {col.render(item)}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-500">
                            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
                        </p>
                        {onPageSizeChange && (
                            <Select
                                options={[
                                    { value: '25', label: '25 per page' },
                                    { value: '50', label: '50 per page' },
                                    { value: '100', label: '100 per page' },
                                ]}
                                value={String(pageSize)}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                className="w-36"
                            />
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => onPageChange?.(page - 1)}
                        >
                            ← Prev
                        </Button>
                        {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (page <= 3) {
                                pageNum = i + 1;
                            } else if (page >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = page - 2 + i;
                            }
                            return (
                                <Button
                                    key={pageNum}
                                    variant={pageNum === page ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => onPageChange?.(pageNum)}
                                >
                                    {pageNum}
                                </Button>
                            );
                        })}
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => onPageChange?.(page + 1)}
                        >
                            Next →
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
