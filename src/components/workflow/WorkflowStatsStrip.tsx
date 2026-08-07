import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { workflowService } from '../../services/workflow/workflow.service';

type Props = {
  division: 'operations' | 'finance' | 'marketing' | 'admin';
  queuePath: string;
  queueLabel: string;
};

const LABELS: Record<string, Record<string, string>> = {
  operations: {
    issueQueue: 'Issue Queue',
    criticalIssue: 'Critical',
    providerDown: 'Provider Down',
    retryNeeded: 'Retry Needed',
    maintenance: 'Maintenance',
    slaAging: 'SLA >24h',
  },
  finance: {
    refundQueue: 'Refund Queue',
    pendingApproval: 'Pending Approval',
    needReview: 'Need Review',
    walletException: 'Wallet Exception',
    settlement: 'Settled Today',
  },
  marketing: {
    feedbackQueue: 'Feedback Queue',
    websiteImprovement: 'Website',
    announcementNeeded: 'Announcement',
    knowledgeNeeded: 'Knowledge',
    campaignSuggestion: 'Campaign',
  },
  admin: {
    totalOpen: 'Open Workflows',
    critical: 'Critical',
    adminQueue: 'Admin Queue',
    actionsToday: 'Actions Today',
  },
};

export const WorkflowStatsStrip: React.FC<Props> = ({ division, queuePath, queueLabel }) => {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const key = division === 'admin' ? 'admin' : division;
    workflowService
      .stats(key)
      .then((s) => {
        const flat: Record<string, number> = {};
        Object.entries(s).forEach(([k, v]) => {
          if (typeof v === 'number') flat[k] = v;
        });
        setStats(flat);
      })
      .catch(() => setStats({}));
  }, [division]);

  const labels = LABELS[division] || {};

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold text-gray-900 uppercase tracking-wider text-[11px]">
          Workflow Engine
        </h2>
        <Link to={queuePath} className="text-xs font-bold text-primary-700 hover:underline">
          {queueLabel} →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(labels).map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-xs">
            <p className="text-[10px] font-bold uppercase text-gray-400">{label}</p>
            <p className="text-xl font-black text-gray-900 mt-1">{stats[key] ?? 0}</p>
          </div>
        ))}
      </div>
    </section>
  );
};
