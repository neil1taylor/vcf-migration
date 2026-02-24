// Lightweight error boundary for individual page sections (charts, AI panels, etc.)
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { InlineNotification, Button } from '@carbon/react';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Descriptive name for the section, shown in the error message */
  sectionName: string;
  /** Use compact InlineNotification mode (default: true) */
  compact?: boolean;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<SectionErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SectionErrorBoundary] Error in "${this.props.sectionName}":`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: '100%' }}>
          <InlineNotification
            kind="error"
            title={`${this.props.sectionName} failed to render`}
            subtitle={this.state.error?.message || 'An unexpected error occurred'}
            lowContrast
            hideCloseButton
          />
          <Button kind="ghost" size="sm" onClick={this.handleRetry} style={{ marginTop: '0.5rem' }}>
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
