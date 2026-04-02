import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import type { SectionProgress } from '@/hooks/useChatGeneration';
import { PLANNING_SECTION_ID } from '@/hooks/useChatGeneration';

// ─── Helpers ────────────────────────────────────────────────────

function StatusIcon({ status }: { status: SectionProgress['status'] }) {
  switch (status) {
    case 'generating': return <Loader2 size={12} className="spin-icon" />;
    case 'done': return <CheckCircle2 size={12} className="done-icon" />;
    case 'error': return <AlertCircle size={12} className="error-icon" />;
    case 'pending': return <span className="pending-dot" />;
  }
}

function getHeaderText(
  phase: string,
  isPlanning: boolean,
  completedCount: number,
  totalCount: number,
): string {
  if (phase === 'planning' || isPlanning) return 'Planning sections…';
  if (phase === 'done') {
    return `Built ${completedCount} section${completedCount !== 1 ? 's' : ''}`;
  }
  return `Building ${completedCount} / ${totalCount} sections`;
}

// ─── Component ──────────────────────────────────────────────────

export default function GenerationProgress() {
  const { sectionProgress, phase, isLoading, statusText } = useChatContext();

  if (sectionProgress.length === 0) return null;

  const completedCount = sectionProgress.filter((s) => s.status === 'done').length;
  const totalCount = sectionProgress.length;
  const isPlanning = sectionProgress[0]?.id === PLANNING_SECTION_ID;
  const progressPercent = totalCount > 1 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="chat-message assistant">
      <div className="message-content">
        <div className="generation-progress">
          {/* Header row */}
          <div className="generation-progress-header">
            {isLoading ? (
              <Loader2 size={13} className="spin-icon" />
            ) : (
              <CheckCircle2 size={13} className="done-icon" />
            )}
            <span>{getHeaderText(phase, isPlanning, completedCount, totalCount)}</span>

            {totalCount > 1 && (
              <div className="generation-progress-bar-wrap">
                <div
                  className="generation-progress-bar"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>

          {/* Per-section list */}
          {!isPlanning && (
            <ul className="section-progress-list">
              {sectionProgress.map((s) => (
                <li key={s.id} className={`section-progress-item ${s.status}`}>
                  <StatusIcon status={s.status} />
                  <span className="section-progress-label">{s.label}</span>
                </li>
              ))}
            </ul>
          )}

        </div>
      </div>
    </div>
  );
}
