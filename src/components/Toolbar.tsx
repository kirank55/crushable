import { useState, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Settings,
  History,
  PanelLeftClose,
  Eye,
  Code,
  Terminal,
  Check,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePageStateContext } from '@/context/PageStateContext';

export default function Toolbar() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { projectName, isDirty, handleSave, handleRename, toggleVersions } =
    usePageStateContext();

  const finishEditingProjectName = () => {
    setIsEditing(false);
    if (inputRef.current) handleRename(inputRef.current.value);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" title="Back to Projects" onClick={() => router.push('/')}>
          <ArrowLeft size={18} />
          <span className="btn-label">Projects</span>
        </button>

        <div className="toolbar-divider" />
        <div className="project-identity">
          {isEditing ? (
            <input
              ref={inputRef}
              defaultValue={projectName}
              onBlur={finishEditingProjectName}
              onKeyDown={(e) => e.key === 'Enter' && finishEditingProjectName()}
              className="project-name-input"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="project-name-btn"
            >
              {projectName}
            </button>
          )}
          <div className={`save-state ${isDirty ? 'dirty' : 'clean'}`}>
            {isDirty ? (
              <span className="save-state-label">Unsaved changes</span>
            ) : (
              <>
                <Check size={12} />
                <span className="save-state-label">All changes saved</span>
              </>
            )}
          </div>
        </div>

        <div className="toolbar-actions toolbar-actions-inline">
          <button className="header-action-btn" title="Versions" onClick={toggleVersions}>
            <History size={16} />
          </button>
          <button className="header-action-btn" title="Hide Chat">
            <PanelLeftClose size={16} />
          </button>
        </div>
      </div>

      <div className="toolbar-center">
        <div className="preview-tabs">
          <button className="preview-tab active">
            <Eye size={14} />
            Preview
          </button>
          <button className="preview-tab">
            <Code size={14} />
            Code
          </button>
          <button className="preview-tab">
            <Terminal size={14} />
            Console
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        <div className="toolbar-primary-group">
          <button className="toolbar-btn settings-btn" title="Model Settings">
            <Settings size={18} />
            <span className="btn-label">Model</span>
          </button>
          <button
            className="toolbar-btn save-btn"
            title="Save"
            onClick={handleSave}
            disabled={!isDirty}
          >
            <Save size={18} />
            <span className="btn-label">Save now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
