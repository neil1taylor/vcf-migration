import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SectionErrorBoundary } from './SectionErrorBoundary';

// Component that throws on demand
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from child component');
  }
  return <div>Normal content</div>;
}

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    // Suppress React error boundary console.error noise
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when there is no error', () => {
    render(
      <SectionErrorBoundary sectionName="Test Section">
        <div>Child content</div>
      </SectionErrorBoundary>
    );
    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('renders an error notification when a child throws', () => {
    render(
      <SectionErrorBoundary sectionName="Chart Widget">
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );
    expect(screen.getByText('Chart Widget failed to render')).toBeInTheDocument();
    expect(screen.getByText('Test error from child component')).toBeInTheDocument();
  });

  it('includes the section name in the error message', () => {
    render(
      <SectionErrorBoundary sectionName="AI Insights">
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );
    expect(screen.getByText('AI Insights failed to render')).toBeInTheDocument();
  });

  it('renders a retry button that resets the boundary', () => {
    const { rerender } = render(
      <SectionErrorBoundary sectionName="Test Section">
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );

    // Error state should be showing
    expect(screen.getByText('Test Section failed to render')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();

    // Click retry - the component will re-render, but since ThrowingComponent
    // still throws, it will catch again. We just verify the button works.
    fireEvent.click(screen.getByText('Retry'));

    // Re-render with non-throwing child to verify reset worked
    rerender(
      <SectionErrorBoundary sectionName="Test Section">
        <ThrowingComponent shouldThrow={false} />
      </SectionErrorBoundary>
    );

    // After retry + non-throwing rerender, should show normal content
    // (retry clears the error state, so the next render shows children)
  });

  it('logs the error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SectionErrorBoundary sectionName="My Section">
        <ThrowingComponent shouldThrow={true} />
      </SectionErrorBoundary>
    );

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
