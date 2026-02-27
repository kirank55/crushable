'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Project } from '@/types';
import { getProjects, deleteProject } from '@/lib/storage';
import { Sparkles, Plus, Trash2, Clock, Settings } from 'lucide-react';
import SettingsModal from '@/components/SettingsModal';

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setProjects(getProjects());
  }, []);

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this project?')) {
      deleteProject(id);
      setProjects(getProjects());
    }
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="project-fullscreen">
      <div className="project-fullscreen-inner">
        <div className="project-fullscreen-header">
          <div className="project-fullscreen-brand">
            <Sparkles size={28} strokeWidth={1.5} />
            <h1>Crushable</h1>
          </div>
          <p className="project-fullscreen-sub">AI Landing Page Builder</p>
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
                      {formatDate(project.updatedAt)}
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
