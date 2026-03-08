'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types';
import { getProjects, deleteProject } from '@/lib/storage';
import { formatRelativeDate } from '@/lib/date';
import { Sparkles, Plus, Trash2, Clock, Settings, LayoutTemplate } from 'lucide-react';
import SettingsModal from '@/components/SettingsModal';
import { TEMPLATE_LIBRARY } from '@/lib/templates';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(() => getProjects());
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <p className="project-fullscreen-sub">AI Page Builder</p>
        </div>

        <div className="project-fullscreen-actions">
          <button
            onClick={() => router.push('/project/new')}
            className="new-project-big-btn"
          >
            <Plus size={20} />
            <span>New Project</span>
          </button>
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

          <div className="template-grid">
            {TEMPLATE_LIBRARY.map((template) => (
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
                  <h3>{template.name}</h3>
                  <p>{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {projects.length > 0 && (
          <div className="project-fullscreen-list">
            <h3>Recent Projects</h3>
            <div className="project-grid">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="project-card"
                >
                  <div className="project-card-info">
                    <span className="project-card-name">{project.name}</span>
                    <span className="project-card-meta">
                      <Clock size={12} />
                      {formatRelativeDate(project.updatedAt)}
                      <span className="project-card-blocks">
                        {project.blocks.length} section{project.blocks.length !== 1 ? 's' : ''}
                      </span>
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="project-delete"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setSettingsOpen(true)}
          className="settings-link-btn"
        >
          <Settings size={14} />
          Settings
        </button>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
