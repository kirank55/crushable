'use client';

import { X, Sparkles, MessageSquare, Zap, Pencil, HelpCircle, Download, History, Smartphone, Code, Keyboard } from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content help-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <HelpCircle size={20} />
                        <div>
                            <h2>How to Use Crushable</h2>
                            <p className="modal-subtitle">A quick guide for planning pages, editing sections, and exporting polished HTML.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="modal-close">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body help-body">
                    <div className="help-section">
                        <h3><Sparkles size={16} /> Getting Started</h3>
                        <ul>
                            <li><strong>New project</strong> - Click &quot;New Project&quot;, describe your product, and Crushable will choose the page style automatically.</li>
                            <li><strong>Generate a full page</strong> - Click the <strong>&quot;Generate Landing Page&quot;</strong> button to build an entire page at once.</li>
                            <li><strong>Add individual sections</strong> - Type &quot;Create a hero section&quot; or &quot;Add a pricing table&quot; in the chat.</li>
                        </ul>
                    </div>

                    <div className="help-section">
                        <h3><Pencil size={16} /> Editing Sections</h3>
                        <ul>
                            <li><strong>Edit a section</strong> - Select it from the dropdown, then describe what to change (for example, &quot;Make the heading bigger&quot;).</li>
                            <li><strong>Smart auto-select</strong> - Just mention a section name: &quot;change the pricing colors&quot; and the AI will find the right section.</li>
                            <li><strong>Edit multiple sections</strong> - Mention multiple sections in one prompt: &quot;change the hero and footer background to dark blue&quot;.</li>
                            <li><strong>Edit the code directly</strong> - Switch to Code view in the top bar, make changes, then click Save.</li>
                        </ul>
                    </div>

                    <div className="help-section">
                        <h3><MessageSquare size={16} /> Chat Tips</h3>
                        <ul>
                            <li><strong>&quot;Try again&quot; or &quot;Retry&quot;</strong> - Re-runs the last generation if you are not happy.</li>
                            <li><strong>&quot;What did you change?&quot;</strong> - The AI will explain its last edit.</li>
                            <li><strong>Be specific</strong> - &quot;Make the CTA button green with rounded corners&quot; works better than &quot;make it better&quot;.</li>
                            <li><strong>Restore checkpoints</strong> - Hover over any of your messages and click &quot;Restore&quot; to go back to that point.</li>
                        </ul>
                    </div>

                    <div className="help-section">
                        <h3><Zap size={16} /> Toolbar Actions</h3>
                        <ul>
                            <li><Smartphone size={12} className="inline-icon" /> <strong>Mobile Preview</strong> - See how your page looks on a phone.</li>
                            <li><Code size={12} className="inline-icon" /> <strong>Code View</strong> - View and edit the raw HTML directly.</li>
                            <li><History size={12} className="inline-icon" /> <strong>Versions</strong> - Browse and restore previous versions of your page.</li>
                            <li><Download size={12} className="inline-icon" /> <strong>Export</strong> - Download your page as a standalone HTML file.</li>
                        </ul>
                    </div>

                    <div className="help-section">
                        <h3><Keyboard size={16} /> Keyboard Shortcuts</h3>
                        <ul>
                            <li><kbd>Enter</kbd> - Send message</li>
                            <li><kbd>Shift + Enter</kbd> - New line in chat</li>
                        </ul>
                    </div>

                    <div className="help-footer">
                        <p>Crushable generates pure HTML + Tailwind CSS. No vendor lock-in - your exported code works anywhere.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
