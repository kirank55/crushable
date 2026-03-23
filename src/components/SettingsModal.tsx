'use client';

import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Key, Cpu, CheckCircle, AlertCircle } from 'lucide-react';
import {
    getApiKey,
    getGenerationStrategy,
    getModel,
    getRefinementLevel,
    setApiKey,
    setGenerationStrategy,
    setModel,
    setRefinementLevel,
} from '@/lib/storage';
import {
    DEFAULT_GENERATION_STRATEGY,
    DEFAULT_REFINEMENT_LEVEL,
    FREE_MODEL,
    GenerationStrategy,
    RefinementLevel,
    getAvailableModels,
} from '@/types';
import { logger } from '@/lib/logger';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [key, setKey] = useState('');
    const [selectedModel, setSelectedModel] = useState(FREE_MODEL);
    const [generationStrategy, setGenerationStrategyState] = useState<GenerationStrategy>(DEFAULT_GENERATION_STRATEGY);
    const [refinementLevel, setRefinementLevelState] = useState<RefinementLevel>(DEFAULT_REFINEMENT_LEVEL);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');


    useEffect(() => {
        if (!isOpen) return;

        const frame = window.requestAnimationFrame(() => {
            setKey(getApiKey());
            setSelectedModel(getModel());
            setGenerationStrategyState(getGenerationStrategy());
            setRefinementLevelState(getRefinementLevel());
            setTestStatus('idle');
            setTestMessage('');
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isOpen]);

    const handleSave = () => {
        logger.action('Settings save', { model: selectedModel, hasKey: !!key, generationStrategy, refinementLevel });
        setApiKey(key);
        setModel(selectedModel);
        setGenerationStrategy(generationStrategy);
        setRefinementLevel(refinementLevel);
        onClose();
    };

    const handleTest = async () => {
        logger.action('Settings test connection', { model: selectedModel });
        setTestStatus('testing');
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: 'Say "OK" and nothing else.',
                    mode: 'new',
                    apiKey: key || undefined,
                    model: selectedModel,
                }),
            });

            if (response.ok) {
                setTestStatus('success');
                setTestMessage('Connection successful!');
            } else {
                const error = await response.json();
                setTestStatus('error');
                setTestMessage(error.error || 'Connection failed');
            }
        } catch {
            setTestStatus('error');
            setTestMessage('Network error');
        }
    };

    const availableModels = getAvailableModels(!!key.trim());

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <SettingsIcon size={20} />
                        <div>
                            <h2>Model Settings</h2>
                            <p className="modal-subtitle">Choose the model, connect OpenRouter, and verify generation before you build.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="modal-close">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="setting-group">
                        <label className="setting-label">
                            <Key size={16} />
                            OpenRouter API Key
                        </label>
                        <p className="setting-hint">Optional — leave empty for free models. Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/keys</a></p>
                        <input
                            type="password"
                            value={key}
                            onChange={(e) => { setKey(e.target.value); setTestStatus('idle'); }}
                            placeholder="sk-or-v1-..."
                            className="setting-input"
                        />
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">
                            <Cpu size={16} />
                            Model
                        </label>
                        <div className="model-grid">
                            {availableModels.map((m) => (
                                <button
                                    key={m.id}
                                    onClick={() => { setSelectedModel(m.id); setTestStatus('idle'); }}
                                    className={`model-option ${selectedModel === m.id ? 'active' : ''}`}
                                    title={m.free ? 'Try available free models' : `Requires API key`}
                                >
                                    <span className="model-name">{m.label}</span>
                                    {m.free && <span className="model-badge free">FREE</span>}
                                </button>
                            ))}
                        </div>
                        {!key.trim() && (
                            <p className="setting-hint" style={{ marginTop: 6 }}>Add an API key above to unlock premium models (Claude, GPT-4o, Gemini)</p>
                        )}
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">Generation Strategy</label>
                        <p className="setting-hint">Choose whether Crushable should prefer raw HTML, templates, or component composition during multi-section generation.</p>
                        <select
                            value={generationStrategy}
                            onChange={(e) => setGenerationStrategyState(e.target.value as GenerationStrategy)}
                            className="setting-input"
                        >
                            <option value="hybrid">Hybrid</option>
                            <option value="template-first">Template First</option>
                            <option value="component-first">Component First</option>
                            <option value="html-only">HTML Only</option>
                        </select>
                    </div>

                    <div className="setting-group">
                        <label className="setting-label">Auto-Refinement</label>
                        <p className="setting-hint">Light applies deterministic validation fixes. Full also runs AI critique and one refinement pass for weak sections.</p>
                        <select
                            value={refinementLevel}
                            onChange={(e) => setRefinementLevelState(e.target.value as RefinementLevel)}
                            className="setting-input"
                        >
                            <option value="off">Off</option>
                            <option value="light">Light</option>
                            <option value="full">Full</option>
                        </select>
                    </div>

                    <div className="setting-actions">
                        <button onClick={handleTest} className="test-button" disabled={testStatus === 'testing'}>
                            {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                        </button>
                    </div>
                    {testStatus === 'success' && (
                        <span className="test-result success"><CheckCircle size={14} /> {testMessage}</span>
                    )}
                    {testStatus === 'error' && (
                        <span className="test-result error"><AlertCircle size={14} /> {testMessage}</span>
                    )}
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save Settings</button>
                </div>
            </div>
        </div>
    );
}
