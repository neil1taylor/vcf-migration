// SVG illustrations for each tutorial step
interface TutorialStepIllustrationProps {
  step: number;
}

export function TutorialStepIllustration({ step }: TutorialStepIllustrationProps) {
  const svgProps = {
    viewBox: '0 0 400 240',
    className: 'tutorial-page__illustration-svg',
    role: 'img' as const,
    'aria-hidden': true as const,
  };

  switch (step) {
    case 1:
      return (
        <svg {...svgProps}>
          <title>Upload your data</title>
          {/* Browser window outline */}
          <rect x="80" y="20" width="240" height="180" rx="6" fill="none" stroke="var(--cds-border-strong-01, #8d8d8d)" strokeWidth="2" />
          <rect x="80" y="20" width="240" height="24" rx="6" fill="var(--cds-layer-02, #e0e0e0)" />
          <circle cx="96" cy="32" r="4" fill="var(--cds-support-error, #da1e28)" />
          <circle cx="110" cy="32" r="4" fill="var(--cds-support-warning, #f1c21b)" />
          <circle cx="124" cy="32" r="4" fill="var(--cds-support-success, #24a148)" />
          {/* Drop zone */}
          <rect x="110" y="64" width="180" height="110" rx="4" fill="none" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="2" strokeDasharray="8 4" />
          {/* File icon with arrow */}
          <rect x="178" y="80" width="44" height="54" rx="3" fill="var(--cds-link-primary, #0f62fe)" opacity="0.15" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" />
          <path d="M210 80 L222 94 L210 94 Z" fill="var(--cds-layer-01, #f4f4f4)" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" />
          <line x1="188" y1="100" x2="210" y2="100" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" />
          <line x1="188" y1="108" x2="206" y2="108" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" />
          <line x1="188" y1="116" x2="212" y2="116" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" />
          {/* Upload arrow */}
          <line x1="200" y1="155" x2="200" y2="140" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="2" />
          <polyline points="192,147 200,138 208,147" fill="none" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="2" />
          <text x="200" y="172" textAnchor="middle" fill="var(--cds-text-secondary, #525252)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif">.xlsx</text>
        </svg>
      );

    case 2:
      return (
        <svg {...svgProps}>
          <title>Review your environment</title>
          {/* Metric tiles row */}
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <rect x={40 + i * 85} y="20" width="75" height="50" rx="4" fill="var(--cds-layer-02, #e0e0e0)" />
              <rect x={48 + i * 85} y="30" width="30" height="8" rx="2" fill="var(--cds-text-secondary, #525252)" opacity="0.4" />
              <text x={48 + i * 85} y="58" fill="var(--cds-text-primary, #161616)" fontSize="16" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif">
                {['142', '3.2K', '18', '96%'][i]}
              </text>
            </g>
          ))}
          {/* Chart placeholder */}
          <rect x="40" y="85" width="200" height="130" rx="4" fill="var(--cds-layer-02, #e0e0e0)" />
          {/* Bar chart bars */}
          {[0, 1, 2, 3, 4].map(i => (
            <rect key={i} x={60 + i * 32} y={130 + (4 - i) * 12} width="20" height={60 - (4 - i) * 12} rx="2" fill="var(--cds-link-primary, #0f62fe)" opacity={0.4 + i * 0.12} />
          ))}
          {/* Donut chart placeholder */}
          <circle cx="315" cy="150" r="50" fill="none" stroke="var(--cds-layer-02, #e0e0e0)" strokeWidth="16" />
          <circle cx="315" cy="150" r="50" fill="none" stroke="var(--cds-support-success, #24a148)" strokeWidth="16" strokeDasharray="220 94" strokeDashoffset="0" />
          <circle cx="315" cy="150" r="50" fill="none" stroke="var(--cds-support-warning, #f1c21b)" strokeWidth="16" strokeDasharray="50 264" strokeDashoffset="-220" />
        </svg>
      );

    case 3:
      return (
        <svg {...svgProps}>
          <title>Explore infrastructure</title>
          {/* Server racks */}
          {[0, 1, 2].map(i => (
            <g key={i}>
              <rect x={60 + i * 110} y="40" width="80" height="120" rx="4" fill="var(--cds-layer-02, #e0e0e0)" stroke="var(--cds-border-strong-01, #8d8d8d)" strokeWidth="1.5" />
              {[0, 1, 2, 3].map(j => (
                <g key={j}>
                  <rect x={68 + i * 110} y={52 + j * 26} width="64" height="18" rx="2" fill="var(--cds-layer-01, #f4f4f4)" />
                  <circle cx={122 + i * 110} cy={61 + j * 26} r="3" fill={j < 3 ? 'var(--cds-support-success, #24a148)' : 'var(--cds-text-secondary, #525252)'} />
                </g>
              ))}
            </g>
          ))}
          {/* Connecting lines */}
          <line x1="140" y1="170" x2="200" y2="200" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="200" y1="170" x2="200" y2="200" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" strokeDasharray="4 3" />
          <line x1="260" y1="170" x2="200" y2="200" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" strokeDasharray="4 3" />
          {/* Network hub */}
          <circle cx="200" cy="210" r="12" fill="var(--cds-link-primary, #0f62fe)" opacity="0.2" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" />
          <circle cx="200" cy="210" r="4" fill="var(--cds-link-primary, #0f62fe)" />
        </svg>
      );

    case 4:
      return (
        <svg {...svgProps}>
          <title>Prepare for migration</title>
          {/* Checklist */}
          <rect x="60" y="20" width="280" height="190" rx="6" fill="var(--cds-layer-02, #e0e0e0)" />
          {['Infrastructure', 'Workload Classification', 'Network Mapping', 'Exclusion Rules', 'Target Location'].map((label, i) => (
            <g key={i}>
              {/* Checkbox */}
              <rect x={80} y={38 + i * 34} width="16" height="16" rx="2" fill={i < 3 ? 'var(--cds-link-primary, #0f62fe)' : 'var(--cds-layer-01, #f4f4f4)'} stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="1.5" />
              {i < 3 && (
                <polyline points={`${84},${47 + i * 34} ${87},${51 + i * 34} ${93},${42 + i * 34}`} fill="none" stroke="var(--cds-icon-on-color, #ffffff)" strokeWidth="2" />
              )}
              {/* Label */}
              <text x="106" y={51 + i * 34} fill="var(--cds-text-primary, #161616)" fontSize="12" fontFamily="IBM Plex Sans, sans-serif">{label}</text>
              {/* Category tag */}
              {i < 3 && (
                <rect x={260} y={37 + i * 34} width="60" height="18" rx="9" fill="var(--cds-link-primary, #0f62fe)" opacity="0.15" />
              )}
            </g>
          ))}
        </svg>
      );

    case 5:
      return (
        <svg {...svgProps}>
          <title>Run pre-flight checks</title>
          {/* Shield */}
          <path d="M200 25 L245 45 L245 120 Q245 170 200 200 Q155 170 155 120 L155 45 Z" fill="var(--cds-link-primary, #0f62fe)" opacity="0.1" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="2" />
          {/* Check results */}
          <g>
            <circle cx="185" cy="80" r="8" fill="var(--cds-support-success, #24a148)" />
            <polyline points="180,80 184,85 191,76" fill="none" stroke="var(--cds-icon-on-color, #ffffff)" strokeWidth="2" />
            <text x="200" y="84" fill="var(--cds-text-primary, #161616)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif">OS Compatible</text>
          </g>
          <g>
            <circle cx="185" cy="110" r="8" fill="var(--cds-support-warning, #f1c21b)" />
            <text x="182" y="114" fill="var(--cds-text-primary, #161616)" fontSize="12" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">!</text>
            <text x="200" y="114" fill="var(--cds-text-primary, #161616)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif">Snapshots Found</text>
          </g>
          <g>
            <circle cx="185" cy="140" r="8" fill="var(--cds-support-success, #24a148)" />
            <polyline points="180,140 184,145 191,136" fill="none" stroke="var(--cds-icon-on-color, #ffffff)" strokeWidth="2" />
            <text x="200" y="144" fill="var(--cds-text-primary, #161616)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif">Hardware Version OK</text>
          </g>
          <g>
            <circle cx="185" cy="170" r="8" fill="var(--cds-support-success, #24a148)" />
            <polyline points="180,170 184,175 191,166" fill="none" stroke="var(--cds-icon-on-color, #ffffff)" strokeWidth="2" />
            <text x="200" y="174" fill="var(--cds-text-primary, #161616)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif">VMware Tools</text>
          </g>
        </svg>
      );

    case 6:
      return (
        <svg {...svgProps}>
          <title>Size your migration</title>
          {/* Profile comparison bars */}
          <text x="40" y="35" fill="var(--cds-text-secondary, #525252)" fontSize="10" fontFamily="IBM Plex Sans, sans-serif">Profile Comparison</text>
          {['bx2-16x64', 'bx2-32x128', 'bx2-48x192', 'mx2-64x512'].map((label, i) => (
            <g key={i}>
              <text x="40" y={62 + i * 44} fill="var(--cds-text-primary, #161616)" fontSize="10" fontFamily="IBM Plex Mono, monospace">{label}</text>
              <rect x="140" y={50 + i * 44} width={60 + i * 50} height="18" rx="2" fill="var(--cds-link-primary, #0f62fe)" opacity={0.4 + i * 0.15} />
              <text x={206 + i * 50} y={63 + i * 44} fill="var(--cds-text-secondary, #525252)" fontSize="10" fontFamily="IBM Plex Sans, sans-serif">
                {['$284', '$568', '$852', '$1,420'][i]}/mo
              </text>
            </g>
          ))}
        </svg>
      );

    case 7:
      return (
        <svg {...svgProps}>
          <title>Review and plan</title>
          {/* Gantt chart */}
          <text x="40" y="30" fill="var(--cds-text-secondary, #525252)" fontSize="10" fontFamily="IBM Plex Sans, sans-serif">Migration Timeline</text>
          {/* Phase bars */}
          {[
            { label: 'Planning', x: 100, w: 80, color: 'var(--cds-link-primary, #0f62fe)' },
            { label: 'Pilot', x: 180, w: 50, color: 'var(--cds-support-info, #4589ff)' },
            { label: 'Wave 1', x: 230, w: 60, color: 'var(--cds-support-success, #24a148)' },
            { label: 'Wave 2', x: 290, w: 60, color: 'var(--cds-support-success, #24a148)' },
            { label: 'Cutover', x: 350, w: 30, color: 'var(--cds-support-warning, #f1c21b)' },
          ].map((phase, i) => (
            <g key={i}>
              <text x="40" y={60 + i * 38} fill="var(--cds-text-primary, #161616)" fontSize="10" fontFamily="IBM Plex Sans, sans-serif">{phase.label}</text>
              <rect x={phase.x} y={48 + i * 38} width={phase.w} height="18" rx="3" fill={phase.color} opacity="0.7" />
            </g>
          ))}
          {/* Gridlines */}
          {[100, 150, 200, 250, 300, 350].map(x => (
            <line key={x} x1={x} y1="38" x2={x} y2="230" stroke="var(--cds-border-subtle-01, #c6c6c6)" strokeWidth="0.5" />
          ))}
        </svg>
      );

    case 8:
      return (
        <svg {...svgProps}>
          <title>Export reports</title>
          {/* Document icons */}
          {[
            { label: 'PDF', color: 'var(--cds-support-error, #da1e28)', x: 60 },
            { label: 'XLSX', color: 'var(--cds-support-success, #24a148)', x: 140 },
            { label: 'DOCX', color: 'var(--cds-link-primary, #0f62fe)', x: 220 },
            { label: 'PPTX', color: 'var(--cds-support-warning, #f1c21b)', x: 300 },
          ].map((doc, i) => (
            <g key={i}>
              <rect x={doc.x} y="40" width="60" height="76" rx="4" fill="var(--cds-layer-02, #e0e0e0)" stroke={doc.color} strokeWidth="2" />
              <path d={`M${doc.x + 40} 40 L${doc.x + 60} 58 L${doc.x + 40} 58 Z`} fill="var(--cds-layer-01, #f4f4f4)" stroke={doc.color} strokeWidth="1.5" />
              {/* Lines */}
              {[0, 1, 2].map(j => (
                <rect key={j} x={doc.x + 10} y={68 + j * 12} width={34 - j * 6} height="4" rx="1" fill={doc.color} opacity="0.3" />
              ))}
              <text x={doc.x + 30} y="134" textAnchor="middle" fill={doc.color} fontSize="12" fontWeight="600" fontFamily="IBM Plex Sans, sans-serif">{doc.label}</text>
            </g>
          ))}
          {/* Download arrow */}
          <line x1="200" y1="160" x2="200" y2="195" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="2.5" />
          <polyline points="188,185 200,200 212,185" fill="none" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="2.5" />
          <line x1="180" y1="210" x2="220" y2="210" stroke="var(--cds-link-primary, #0f62fe)" strokeWidth="2.5" />
        </svg>
      );

    default:
      return null;
  }
}
