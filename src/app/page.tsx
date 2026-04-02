'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { Plus, ArrowRight, Layers3, Clock, Trash2 } from 'lucide-react';
import { getProjects, saveProject, deleteProject } from '@/lib/storage';
import { formatRelativeDate } from '@/lib/date';
import { Project } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [productBrief, setProductBrief] = useState('');
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [triedToCreate, setTriedToCreate] = useState(false);

  const briefLength = productBrief.trim().length;
  const canCreateProject = briefLength >= 50;

  useEffect(() => {
    setRecentProjects(getProjects().slice(0, 6));
  }, []);

  const handleCreateProject = () => {
    if (!canCreateProject) {
      setTriedToCreate(true);
      return;
    }
    const id = uuidv4();
    const project: Project = {
      id,
      name: 'Untitled Project',
      blocks: [],
      messages: [
        {
          id: uuidv4(),
          role: 'user',
          content: productBrief.trim(),
          timestamp: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    };
    saveProject(project);
    router.push(`/project/${id}`);
  };

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteProject(id);
    setRecentProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="project-fullscreen">
      <div className="project-fullscreen-inner">
        <div className="project-fullscreen-header flex justify-between">
          <div className="project-fullscreen-brand">
            <Layers3 size={28} strokeWidth={1.5} />
            <h1>Crushable</h1>
          </div>
          <p className="project-fullscreen-sub">AI landing page builder</p>
        </div>

        <div className="project-hero">
          <div className="project-hero-copy">
            <span className="project-hero-eyebrow">AI project builder</span>
            <h2>Build a landing page from a single product brief.</h2>
            <p>
              Describe what you are building and
              export clean HTML is ready.
            </p>
            <div className={`project-brief-card ${triedToCreate && !canCreateProject ? 'error' : ''}`}>
              <label htmlFor="product-brief" className="project-brief-label">
                Write few lines about your product
              </label>
              <textarea
                id="product-brief"
                value={productBrief}
                onChange={(event) => {
                  setProductBrief(event.target.value);
                  if (triedToCreate) setTriedToCreate(false);
                }}
                placeholder="Describe what your product does, who it is for, and why it matters."
                rows={5}
                className="project-brief-textarea"
              />
              <div className="project-brief-footer">
                <span
                  className={`project-brief-hint ${canCreateProject ? 'valid' : 'invalid'}`}
                >
                  {canCreateProject
                    ? 'Looks good. We can generate the first draft from this.'
                    : `Write at least 50 characters to create a project (${briefLength}/50).`}
                </span>
                <span className="project-brief-meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (briefLength / 50) * 100)}%` }} />
                </span>
              </div>
            </div>
            <button
              onClick={handleCreateProject}
              className="new-project-big-btn"
              disabled={!canCreateProject}
            >
              <Plus size={20} />
              <span>Create Project</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* {recentProjects.length > 0 && ( */}
        <div className="recent-projects-section">
          <div className="recent-projects-header">
            <Clock size={16} />
            <h3>Recent Projects</h3>
          </div>

          {recentProjects.length > 0 ? (

            <div className="recent-projects-grid">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="project-card"
                  onClick={() => router.push(`/project/${project.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && router.push(`/project/${project.id}`)}
                >
                  <div className="project-card-body">
                    <span className="project-card-name">{project.name}</span>
                    <span className="project-card-meta">
                      {project.blocks.length} section{project.blocks.length !== 1 ? 's' : ''} ·{' '}
                      {formatRelativeDate(project.updatedAt)}
                    </span>
                  </div>
                  <button
                    className="project-card-delete"
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    title="Delete project"
                    aria-label="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

          ) : <div className="recent-projects-grid">No recent projects</div>}

        </div>

        <div className="project-footer-actions">
          <span className="settings-link-note">
            <Layers3 size={14} />
            Projects are stored locally in this browser.
          </span>
        </div>
      </div>
    </div>
  );
}
