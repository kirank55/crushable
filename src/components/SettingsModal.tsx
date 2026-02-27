'use client';

import { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsIcon, X, Key, Cpu, CheckCircle, AlertCircle } from 'lucide-react';
import { getApiKey, setApiKey, getModel, setModel } from '@/lib/storage';
import { FREE_MODEL, getAvailableModels } from '@/types';
import { logger } from '@/lib/logger';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [key, setKey] = useState('');
    const [selectedModel, setSelectedModel] = useState(FREE_MODEL);
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');
    const [customModel, setCustomModel] = useState('');
    const models = useMemo(() => getAvailableModels(!!key), [key]);

    useEffect(() => {
        if (isOpen) {
            setKey(getApiKey());
            setSelectedModel(getModel());
            setTestStatus('idle');
        }
    }, [isOpen]);

    const handleSave = () => {
        logger.action('Settings save', { model: selectedModel, hasKey: !!key });
        setApiKey(key);
        setModel(selectedModel);
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

    const handleModelChange = (model: string) => {
        logger.action('Settings model change', { model });
        setSelectedModel(model);
        setCustomModel('');
        setTestStatus('idle');
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-title">
                        <SettingsIcon size={20} />
                        <h2>Settings</h2>
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
                            {models.map((model) => (
                                <button
                                    key={model.id}
                                    onClick={() => handleModelChange(model.id)}
                                    className={`model-option ${selectedModel === model.id ? 'active' : ''}`}
                                >
                                    <span className="model-name">{model.label}</span>
                                    {model.free && <span className="model-badge free">FREE</span>}
                                </button>
                            ))}
                        </div>
                        <div className="custom-model-input">
                            <label className="setting-hint">Or enter a custom OpenRouter model ID:</label>
                            <input
                                type="text"
                                value={customModel}
                                onChange={(e) => {
                                    setCustomModel(e.target.value);
                                    if (e.target.value.trim()) {
                                        setSelectedModel(e.target.value.trim());
                                    }
                                    setTestStatus('idle');
                                }}
                                placeholder="e.g. anthropic/claude-sonnet-4"
                                className="setting-input"
                            />
                        </div>
                    </div>

                    <div className="setting-actions">
                        <button onClick={handleTest} className="test-button" disabled={testStatus === 'testing'}>
                            {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
                        </button>
                        {testStatus === 'success' && (
                            <span className="test-result success"><CheckCircle size={14} /> {testMessage}</span>
                        )}
                        {testStatus === 'error' && (
                            <span className="test-result error"><AlertCircle size={14} /> {testMessage}</span>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={handleSave} className="btn-primary">Save Settings</button>
                </div>
            </div>
        </div>
    );
}
