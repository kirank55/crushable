'use client';

import { useState } from 'react';
import { Plus, ArrowRight, Layers3, Sparkles, MessageSquareText, Code2 } from 'lucide-react';

export default function HomePage() {

  const [productBrief, setProductBrief] = useState('');

  const briefLength = productBrief.trim().length;
  const canCreateProject = briefLength >= 50;

  const handleCreateProject = () => {
    const trimmedBrief = productBrief.trim();

    // Phase 1: no routing — placeholder alert
    alert(`Project brief accepted (${trimmedBrief.length} chars). Routing will be wired in Phase 3.`);
  };

  return (
    <div className="project-fullscreen">
      <div className="project-fullscreen-inner">
        <div className="project-fullscreen-header">
          <div className="project-fullscreen-brand">
            <Layers3 size={28} strokeWidth={1.5} />
            <h1>Crushable</h1>
          </div>
          <p className="project-fullscreen-sub">AI landing page builder</p>
        </div>

        <div className="project-hero">
          <div className="project-hero-copy">
            <span className="project-hero-eyebrow">AI project builder</span>
            <h2>Build a polished landing page from a single product brief.</h2>
            <p>
              Describe what you are building, generate a page plan, refine sections in chat, and
              export clean HTML when it is ready.
            </p>
            <div className="project-brief-card">
              <label htmlFor="product-brief" className="project-brief-label">
                Write few lines about your product
              </label>
              <textarea
                id="product-brief"
                value={productBrief}
                onChange={(event) => setProductBrief(event.target.value)}
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

        {/* Recent Projects grid will be added in Phase 3 when storage is wired */}

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
