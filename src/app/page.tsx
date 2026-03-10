'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types';
import { getProjects, deleteProject } from '@/lib/storage';
import { formatRelativeDate } from '@/lib/date';
import {
  Sparkles,
  Plus,
  Trash2,
  Clock,
  Settings,
  LayoutTemplate,
  ArrowRight,
  Layers3,
} from 'lucide-react';
import SettingsModal from '@/components/SettingsModal';
import { TEMPLATE_LIBRARY } from '@/lib/templates';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProjects(getProjects());
    setMounted(true);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTemplateCategory, setActiveTemplateCategory] = useState('All');

  const templateCategories = useMemo(
    () => ['All', ...new Set(TEMPLATE_LIBRARY.map((template) => template.category))],
    []
  );

  const filteredTemplates = useMemo(
    () =>
      activeTemplateCategory === 'All'
        ? TEMPLATE_LIBRARY
        : TEMPLATE_LIBRARY.filter((template) => template.category === activeTemplateCategory),
    [activeTemplateCategory]
  );
  const firstTemplate = filteredTemplates[0] || TEMPLATE_LIBRARY[0];

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this project?')) {
      deleteProject(id);
      setProjects(getProjects());
    }
  }, []);

  return (
    <div className="project-fullscreen">
      <div className="project-fullscreen-inner">
        <div className="project-fullscreen-header">
          <div className="project-fullscreen-brand">
            <Sparkles size={28} strokeWidth={1.5} />
            <h1>Crushable</h1>
          </div>
          <p className="project-fullscreen-sub">AI page builder for polished multi-page projects</p>
        </div>

        <div className="project-hero">
          <div className="project-hero-copy">
            <span className="project-hero-eyebrow">Plan, generate, refine, export</span>
            <h2>Go from product brief to a branded HTML project without leaving the builder.</h2>
            <p>
              Start from a blank idea or pick a launch-ready template. Crushable guides the first run,
              builds sections in chat, and keeps preview, code, and version history in sync.
            </p>
            <div className="project-hero-metrics">
              <div className="project-hero-metric">
                <strong>{TEMPLATE_LIBRARY.length}</strong>
                <span>starter templates</span>
              </div>
              <div className="project-hero-metric">
                <strong>{mounted ? projects.length : '—'}</strong>
                <span>recent local projects</span>
              </div>
              <div className="project-hero-metric">
                <strong>HTML</strong>
                <span>export with zero lock-in</span>
              </div>
            </div>
          </div>

          <div className="project-fullscreen-actions">
            <div className="hero-action-card">
              <span className="hero-action-label">Start fresh</span>
              <button
                onClick={() => router.push('/project/new')}
                className="new-project-big-btn"
              >
                <Plus size={20} />
                <span>Blank Project</span>
                <ArrowRight size={18} />
              </button>
              <p>Best when you want Crushable to plan the full structure from your description.</p>
            </div>

            <div className="hero-action-card secondary">
              <span className="hero-action-label">Use a template</span>
              <button
                onClick={() => {
                  if (!firstTemplate) return;
                  router.push(`/project/new?template=${firstTemplate.id}`);
                }}
                className="template-starter-btn"
                disabled={!firstTemplate}
              >
                <LayoutTemplate size={18} />
                <span>Start from {firstTemplate?.name || 'a template'}</span>
              </button>
              <p>Choose a use-case below, then customize sections, copy, and layout with chat.</p>
            </div>
          </div>
        </div>

        <div className="template-showcase">
          <div className="template-showcase-header">
            <div>
              <p className="template-showcase-eyebrow">Start from something close</p>
              <h2>Pick a built-in template</h2>
            </div>
            <div className="template-showcase-note">
              <LayoutTemplate size={14} />
              Static HTML starter pages you can edit with chat, preview, and code.
            </div>
          </div>

          <div className="template-filter-row" aria-label="Template filters">
            {templateCategories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveTemplateCategory(category)}
                className={`template-filter-chip ${activeTemplateCategory === category ? 'active' : ''}`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="template-grid">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => router.push(`/project/new?template=${template.id}`)}
                className="template-card"
              >
                <div
                  className="template-card-preview"
                  style={{ background: template.preview.accent }}
                >
                  <span>{template.preview.eyebrow}</span>
                  <strong>{template.name}</strong>
                  <p>{template.preview.title}</p>
                </div>
                <div className="template-card-body">
                  <div className="template-card-topline">
                    <span className="template-card-category">{template.category}</span>
                    <span className="template-card-style">{template.designStyle}</span>
                  </div>
                  <p>{template.description}</p>
                  <span className="template-card-cta">
                    Open template
                    <ArrowRight size={14} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {projects.length > 0 && (
          <div className="project-fullscreen-list">
            <div className="project-list-header">
              <div>
                <h3>Recent Projects</h3>
                <p>Reopen a local draft and continue from the latest saved version.</p>
              </div>
            </div>
            <div className="project-grid">
              {projects.map((project) => (
                <div key={project.id} className="project-card-shell">
                  <button
                    onClick={() => router.push(`/project/${project.id}`)}
                    className="project-card"
                  >
                    <div className="project-card-preview">
                      <div className="project-card-preview-bars">
                        {project.blocks.slice(0, 3).map((block, index) => (
                          <span
                            key={block.id}
                            style={{ width: `${78 - index * 12}%` }}
                          />
                        ))}
                        {project.blocks.length === 0 && <span style={{ width: '52%' }} />}
                      </div>
                    </div>
                    <div className="project-card-info">
                      <span className="project-card-name">{project.name}</span>
                      <span className="project-card-meta">
                        <Clock size={12} />
                        Updated {formatRelativeDate(project.updatedAt)}
                        <span className="project-card-blocks">
                          {project.blocks.length} section{project.blocks.length !== 1 ? 's' : ''}
                        </span>
                      </span>
                      <span className="project-card-context">
                        {project.blocks.slice(0, 2).map((block) => block.label).join(' • ') || 'Blank draft'}
                      </span>
                    </div>
                    <span className="project-card-open">
                      Open
                      <ArrowRight size={14} />
                    </span>
                  </button>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="project-delete"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="project-footer-actions">
          <button
            onClick={() => setSettingsOpen(true)}
            className="settings-link-btn"
          >
            <Settings size={14} />
            Settings
          </button>
          <span className="settings-link-note">
            <Layers3 size={14} />
            Projects are stored locally in this browser.
          </span>
        </div>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
