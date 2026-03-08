'use client';

import { useMemo, useState } from 'react';
import { Block } from '@/types';
import { Copy, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';

interface SectionPanelProps {
    blocks: Block[];
    selectedBlockId: string | null;
    onSelectBlock: (id: string) => void;
    onReorderBlocks: (blocks: Block[]) => void;
    onDuplicateBlock: (id: string) => void;
    onRemoveBlock: (id: string) => void;
    onToggleVisibility: (id: string) => void;
}

function moveBlock(blocks: Block[], fromIndex: number, toIndex: number): Block[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return blocks;

    const next = [...blocks];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}

export default function SectionPanel({
    blocks,
    selectedBlockId,
    onSelectBlock,
    onReorderBlocks,
    onDuplicateBlock,
    onRemoveBlock,
    onToggleVisibility,
}: SectionPanelProps) {
    const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
    const [dropTargetBlockId, setDropTargetBlockId] = useState<string | null>(null);

    const hiddenCount = useMemo(
        () => blocks.filter((block) => block.visible === false).length,
        [blocks]
    );

    const handleDrop = (targetBlockId: string) => {
        if (!draggedBlockId || draggedBlockId === targetBlockId) {
            setDraggedBlockId(null);
            setDropTargetBlockId(null);
            return;
        }

        const fromIndex = blocks.findIndex((block) => block.id === draggedBlockId);
        const toIndex = blocks.findIndex((block) => block.id === targetBlockId);
        const next = moveBlock(blocks, fromIndex, toIndex);

        if (next !== blocks) {
            onReorderBlocks(next);
        }

        setDraggedBlockId(null);
        setDropTargetBlockId(null);
    };

    return (
        <aside className="section-panel" aria-label="Sections">
            <div className="section-panel-header">
                <div>
                    <h2>Sections</h2>
                    <p>
                        {blocks.length} total
                        {hiddenCount > 0 ? ` · ${hiddenCount} hidden in preview` : ''}
                    </p>
                </div>
            </div>

            {blocks.length === 0 ? (
                <div className="section-panel-empty">
                    <p>No sections yet.</p>
                    <span>Generate a page or import HTML to manage structure here.</span>
                </div>
            ) : (
                <div className="section-list">
                    {blocks.map((block, index) => {
                        const isSelected = block.id === selectedBlockId;
                        const isHidden = block.visible === false;
                        const isDropTarget = block.id === dropTargetBlockId && draggedBlockId !== block.id;

                        return (
                            <button
                                key={block.id}
                                type="button"
                                className={`section-item ${isSelected ? 'selected' : ''} ${isHidden ? 'hidden' : ''} ${isDropTarget ? 'drop-target' : ''}`}
                                onClick={() => onSelectBlock(block.id)}
                                draggable
                                onDragStart={() => {
                                    setDraggedBlockId(block.id);
                                    setDropTargetBlockId(block.id);
                                }}
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    if (dropTargetBlockId !== block.id) {
                                        setDropTargetBlockId(block.id);
                                    }
                                }}
                                onDragEnd={() => {
                                    setDraggedBlockId(null);
                                    setDropTargetBlockId(null);
                                }}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    handleDrop(block.id);
                                }}
                            >
                                <span className="section-item-grip" aria-hidden="true">
                                    <GripVertical size={14} />
                                </span>

                                <span className="section-item-content">
                                    <span className="section-item-order">{String(index + 1).padStart(2, '0')}</span>
                                    <span className="section-item-text">
                                        <span className="section-item-title">{block.label}</span>
                                        <span className="section-item-meta">{block.id}{isHidden ? ' · hidden in preview' : ''}</span>
                                    </span>
                                </span>

                                <span className="section-item-actions">
                                    <span className={`section-item-visibility ${isHidden ? 'is-hidden' : ''}`}>
                                        {isHidden ? 'Hidden' : 'Visible'}
                                    </span>
                                    <span className="section-item-action-group">
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            className="section-item-action"
                                            title={isHidden ? 'Show in preview' : 'Hide in preview'}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onToggleVisibility(block.id);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    onToggleVisibility(block.id);
                                                }
                                            }}
                                        >
                                            {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                        </span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            className="section-item-action"
                                            title="Duplicate section"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onDuplicateBlock(block.id);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    onDuplicateBlock(block.id);
                                                }
                                            }}
                                        >
                                            <Copy size={14} />
                                        </span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            className="section-item-action danger"
                                            title="Delete section"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemoveBlock(block.id);
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    onRemoveBlock(block.id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </span>
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </aside>
    );
}