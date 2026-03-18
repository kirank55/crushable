'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Clock, Settings, ArrowRight, Layers3, Sparkles, MessageSquareText, Code2 } from 'lucide-react';
import SettingsModal from '@/components/SettingsModal';
import { formatRelativeDate } from '@/lib/date';
import { getProjects, deleteProject } from '@/lib/storage';
import { Project } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setProjects(getProjects());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

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
            <Layers3 size={28} strokeWidth={1.5} />
            <h1>Crushable</h1>
          </div>
          <p className="project-fullscreen-sub">AI page builder for polished multi-page projects</p>
        </div>

        <div className="project-hero">
          <div className="project-hero-copy">
            <span className="project-hero-eyebrow">AI project builder</span>
            <h2>Build a polished multi-page project from a single product brief.</h2>
            <p>
              Describe what you are building, generate a page plan, refine sections in chat, and
              export clean HTML when it is ready.
            </p>
            <button
              onClick={() => router.push('/project/new')}
              className="new-project-big-btn"
            >
              <Plus size={20} />
              <span>Start New Project</span>
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="project-hero-visual" aria-hidden="true">
            <div className="hero-visual-frame">
              <div className="hero-visual-topbar">
                <span />
                <span />
                <span />
              </div>

              <div className="hero-visual-canvas">
                <div className="hero-visual-sidebar">
                  <span className="hero-visual-pill wide" />
                  <span className="hero-visual-pill" />
                  <span className="hero-visual-pill" />
                </div>

                <div className="hero-visual-page">
                  <div className="hero-visual-page-header">
                    <div className="hero-visual-badge">
                      <Sparkles size={14} />
                      <span>AI build flow</span>
                    </div>
                    <span className="hero-visual-title" />
                    <span className="hero-visual-copy" />
                    <span className="hero-visual-copy short" />
                  </div>

                  <div className="hero-visual-grid">
                    <div className="hero-visual-card tall">
                      <div className="hero-visual-card-icon">
                        <MessageSquareText size={18} />
                      </div>
                      <strong>Describe your project</strong>
                      <span>Turn a rough brief into a structured plan.</span>
                    </div>
                    <div className="hero-visual-card">
                      <div className="hero-visual-card-icon">
                        <Layers3 size={18} />
                      </div>
                      <strong>Generate sections</strong>
                    </div>
                    <div className="hero-visual-card wide">
                      <div className="hero-visual-card-icon">
                        <Code2 size={18} />
                      </div>
                      <strong>Refine and export HTML</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
