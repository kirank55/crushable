'use client';

import { useState, useEffect } from 'react';
import { Project } from '@/types';
import { getProjects, deleteProject, saveProject } from '@/lib/storage';
import { FolderOpen, Plus, Trash2, X, Clock, Sparkles, CheckCircle, Circle } from 'lucide-react';

interface ProjectSidebarProps {
    isOpen: boolean;
    isFullScreen?: boolean;
    onClose: () => void;
    currentProjectId: string | null;
    onLoadProject: (project: Project) => void;
    onNewProject: () => void;
}

export default function ProjectSidebar({
    isOpen,
    isFullScreen = false,
    onClose,
    currentProjectId,
    onLoadProject,
    onNewProject,
}: ProjectSidebarProps) {
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        if (isOpen) {
            setProjects(getProjects());
        }
    }, [isOpen]);

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this project?')) {
            deleteProject(id);
            setProjects(getProjects());
        }
    };

    const handleToggleStatus = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = project.status === 'completed' ? 'in-progress' : 'completed';
        const updated = { ...project, status: newStatus as 'in-progress' | 'completed' };
        saveProject(updated);
        setProjects(getProjects());
    };

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

    const inProgressProjects = projects.filter(p => p.status !== 'completed');
    const completedProjects = projects.filter(p => p.status === 'completed');

    if (!isOpen) return null;

    const renderProjectItem = (project: Project, isCard: boolean = false) => {
        const className = isCard
            ? `project-card ${project.id === currentProjectId ? 'active' : ''}`
            : `project-item ${project.id === currentProjectId ? 'active' : ''}`;

        return (
            <button
                key={project.id}
                onClick={() => { onLoadProject(project); onClose(); }}
                className={className}
            >
                <div className={isCard ? 'project-card-info' : 'project-info'}>
                    <span className={isCard ? 'project-card-name' : 'project-name'}>{project.name}</span>
                    <span className={isCard ? 'project-card-meta' : 'project-meta'}>
                        <Clock size={12} />
                        {formatDate(project.updatedAt)}
                        <span className={isCard ? 'project-card-blocks' : 'project-blocks'}>
                            {project.blocks.length} section{project.blocks.length !== 1 ? 's' : ''}
                        </span>
                    </span>
                </div>
                <div className="project-actions-group">
                    <button
                        onClick={(e) => handleToggleStatus(project, e)}
                        className={`project-status-btn ${project.status === 'completed' ? 'completed' : ''}`}
                        title={project.status === 'completed' ? 'Mark as In Progress' : 'Mark as Completed'}
                    >
                        {project.status === 'completed' ? <CheckCircle size={14} /> : <Circle size={14} />}
                    </button>
                    <button
                        onClick={(e) => handleDelete(project.id, e)}
                        className="project-delete"
                        title="Delete project"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </button>
        );
    };

    if (isFullScreen) {
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
                        <button onClick={() => { onNewProject(); onClose(); }} className="new-project-big-btn">
                            <Plus size={20} />
                            <span>New Project</span>
                        </button>
                    </div>

                    {inProgressProjects.length > 0 && (
                        <div className="project-fullscreen-list">
                            <h3>In Progress</h3>
                            <div className="project-grid">
                                {inProgressProjects.map((project) => renderProjectItem(project, true))}
                            </div>
                        </div>
                    )}

                    {completedProjects.length > 0 && (
                        <div className="project-fullscreen-list">
                            <h3>Completed</h3>
                            <div className="project-grid">
                                {completedProjects.map((project) => renderProjectItem(project, true))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="sidebar-overlay" onClick={onClose} />
            <div className={`project-sidebar open`}>
                <div className="sidebar-header">
                    <div className="sidebar-title">
                        <FolderOpen size={18} />
                        <span>Projects</span>
                    </div>
                    <button onClick={onClose} className="sidebar-close">
                        <X size={18} />
                    </button>
                </div>

                <button onClick={() => { onNewProject(); onClose(); }} className="new-project-btn">
                    <Plus size={16} />
                    New Project
                </button>

                <div className="project-list">
                    {projects.length === 0 ? (
                        <div className="no-projects">
                            <p>No saved projects yet</p>
                        </div>
                    ) : (
                        <>
                            {inProgressProjects.length > 0 && (
                                <div className="project-category">
                                    <h4 className="project-category-title">In Progress</h4>
                                    {inProgressProjects.map((project) => renderProjectItem(project))}
                                </div>
                            )}
                            {completedProjects.length > 0 && (
                                <div className="project-category">
                                    <h4 className="project-category-title">Completed</h4>
                                    {completedProjects.map((project) => renderProjectItem(project))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
