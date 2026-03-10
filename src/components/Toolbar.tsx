"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Download,
  Save,
  Settings,
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  Upload,
  Smartphone,
  History,
  PanelLeftClose,
  Eye,
  Code,
  Terminal,
  HelpCircle,
  Layers,
} from "lucide-react";
import { downloadHTML } from "@/lib/export";
import { getApiKey, getModel } from "@/lib/storage";
import { Block, getAvailableModels } from "@/types";
import { readFileAsText, parseImportedHtml } from "@/lib/import";
import { logger } from "@/lib/logger";

function formatSavedTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSaveStateCopy(
  isDirty: boolean,
  showSaved: boolean,
  lastSavedAt: number | null,
): { label: string; meta: string } {
  if (isDirty) {
    return {
      label: "Unsaved changes",
      meta: "",
    };
  }

  if (showSaved) {
    return {
      label: "Saved ✓",
      meta: "",
    };
  }

  if (lastSavedAt) {
    return {
      label: `Saved at ${formatSavedTime(lastSavedAt)}`,
      meta: "",
    };
  }

  return {
    label: "All changes saved",
    meta: "",
  };
}

interface ToolbarProps {
  blocks: Block[];
  projectName: string;
  isDirty: boolean;
  onSave: () => void;
  onRename: (name: string) => void;
  onOpenSettings: () => void;
  onOpenProjects: () => void;
  onNewProject: () => void;
  onClearAll: () => void;
  onImportBlocks: (blocks: Block[]) => void;
  onToggleMobilePreview?: () => void;
  onOpenVersions?: () => void;
  onHideChat?: () => void;
  onOpenHelp?: () => void;
  onToggleSectionsPanel?: () => void;
  chatVisible?: boolean;
  sectionsVisible?: boolean;
  viewMode?: "preview" | "code" | "console";
  onViewModeChange?: (mode: "preview" | "code" | "console") => void;
}

export default function Toolbar({
  blocks,
  projectName,
  isDirty,
  onSave,
  onRename,
  onOpenSettings,
  onOpenProjects,
  onNewProject,
  onClearAll,
  onImportBlocks,
  onToggleMobilePreview,
  onOpenVersions,
  onHideChat,
  onOpenHelp,
  onToggleSectionsPanel,
  chatVisible,
  sectionsVisible,
  viewMode,
  onViewModeChange,
}: ToolbarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(projectName);
  const [modelLabel, setModelLabel] = useState(() => {
    const model = getModel();
    const models = getAvailableModels(!!getApiKey().trim());
    const info = models.find((m) => m.id === model);
    return info?.label || model;
  });
  const [showSaved, setShowSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const syncModelLabel = useCallback(() => {
    const model = getModel();
    const models = getAvailableModels(!!getApiKey().trim());
    const info = models.find((m) => m.id === model);
    setModelLabel(info?.label || model);
  }, []);

  useEffect(() => {
    const handleSettingsChanged = () => syncModelLabel();

    window.addEventListener("storage", handleSettingsChanged);
    window.addEventListener(
      "crushable:settings-changed",
      handleSettingsChanged,
    );

    return () => {
      window.removeEventListener("storage", handleSettingsChanged);
      window.removeEventListener(
        "crushable:settings-changed",
        handleSettingsChanged,
      );
    };
  }, [syncModelLabel]);

  const handleSave = () => {
    logger.action("Toolbar save");
    onSave();
    setLastSavedAt(Date.now());
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const handleRename = () => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  const handleBackToProjects = () => {
    onOpenProjects();
  };

  const handleClearAll = () => {
    if (blocks.length === 0) return;

    const confirmed = window.confirm("Clear all sections from this project?");
    if (!confirmed) return;

    onClearAll();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    logger.action("Toolbar import", { fileName: file.name });

    const confirmed = window.confirm(
      "Only import code generated with Crushable.\n\nImporting code from other sources may not work correctly. Continue?",
    );

    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const html = await readFileAsText(file);
      const importedBlocks = parseImportedHtml(html);

      if (importedBlocks.length === 0) {
        alert(
          'No Crushable sections found in this file. Make sure the file contains <section data-block-id="..."> elements.',
        );
        return;
      }

      onImportBlocks(importedBlocks);
      logger.action("Import successful", {
        blocksImported: importedBlocks.length,
      });
    } catch (err) {
      logger.error("Import", err);
      alert("Failed to import file.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const saveState = getSaveStateCopy(isDirty, showSaved, lastSavedAt);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          onClick={handleBackToProjects}
          className="toolbar-btn"
          title="Back to Projects"
        >
          <ArrowLeft size={18} />
          <span className="btn-label">Projects</span>
        </button>

        <div className="toolbar-divider" />
        <div className="project-identity">
          <span className="project-eyebrow">Current project</span>
          {isEditing ? (
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="project-name-input"
              autoFocus
            />
          ) : (
            <button
              onClick={() => {
                setEditName(projectName);
                setIsEditing(true);
              }}
              className="project-name-btn"
            >
              {projectName}
            </button>
          )}
          <div className={`save-state ${isDirty ? "dirty" : "clean"}`}>
            <span className="save-state-label">{saveState.label}</span>
            <span className="save-state-meta">{saveState.meta}</span>
          </div>
        </div>

        <div className="toolbar-actions toolbar-actions-inline">
          {onOpenVersions && (
            <button
              onClick={onOpenVersions}
              className="header-action-btn"
              title="Versions"
            >
              <History size={16} />
            </button>
          )}
          {onHideChat && chatVisible && (
            <button
              onClick={onHideChat}
              className="header-action-btn"
              title="Hide Chat"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
          {onToggleSectionsPanel && (
            <button
              onClick={onToggleSectionsPanel}
              className={`header-action-btn ${sectionsVisible ? "active" : ""}`}
              title="Toggle Sections Panel"
            >
              <Layers size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="toolbar-center">
        {viewMode && onViewModeChange && (
          <div className="preview-tabs">
            <button
              onClick={() => onViewModeChange("preview")}
              className={`preview-tab ${viewMode === "preview" ? "active" : ""}`}
            >
              <Eye size={14} />
              Preview
            </button>
            <button
              onClick={() => onViewModeChange("code")}
              className={`preview-tab ${viewMode === "code" ? "active" : ""}`}
            >
              <Code size={14} />
              Code
            </button>
            <button
              onClick={() => onViewModeChange("console")}
              className={`preview-tab ${viewMode === "console" ? "active" : ""}`}
            >
              <Terminal size={14} />
              Console
            </button>
          </div>
        )}
      </div>

      <div className="toolbar-right">
        <div className="toolbar-utility-group">
          {onToggleMobilePreview && (
            <button
              onClick={onToggleMobilePreview}
              className="header-action-btn"
              title="Mobile Preview"
            >
              <Smartphone size={16} />
            </button>
          )}

          <button
            onClick={onNewProject}
            className="toolbar-btn"
            title="New Project"
          >
            <Plus size={18} />
            <span className="btn-label">New</span>
          </button>

          <button
            onClick={handleClearAll}
            className="toolbar-btn"
            title="Clear All"
            disabled={blocks.length === 0}
          >
            <Trash2 size={18} />
            <span className="btn-label">Clear</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleImport}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="toolbar-btn"
            title="Import HTML"
          >
            <Upload size={18} />
            <span className="btn-label">Import</span>
          </button>

          <button
            onClick={() => downloadHTML(blocks, projectName)}
            className="toolbar-btn download-btn"
            disabled={blocks.length === 0}
            title="Download HTML"
          >
            <Download size={18} />
            <span className="btn-label">Export</span>
          </button>
        </div>

        <div className="toolbar-primary-group">
          <button
            onClick={onOpenSettings}
            className="toolbar-btn settings-btn"
            title={modelLabel || "Model Settings"}
          >
            <Settings size={18} />
            <span className="btn-label">{modelLabel || "Model"}</span>
          </button>

          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="toolbar-btn help-btn"
              title="Help & Tips"
            >
              <HelpCircle size={18} />
              <span className="btn-label">Help</span>
            </button>
          )}

          <button
            onClick={handleSave}
            className="toolbar-btn save-btn"
            title="Save"
          >
            {showSaved ? <Check size={18} /> : <Save size={18} />}
            <span className="btn-label">{showSaved ? "Saved!" : "Save now"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
