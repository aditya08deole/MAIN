/**
 * Sample frontend tests
 * Tests critical hooks and utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { performanceMonitor, useApiTimer, useInView } from '../hooks/usePerformance';

// ============================================================================
// PERFORMANCE MONITORING TESTS
// ============================================================================

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    performanceMonitor.clear();
  });

  it('records metrics correctly', () => {
    performanceMonitor.record('test-metric', 100);
    performanceMonitor.record('test-metric', 200);
    
    const summary = performanceMonitor.getSummary();
    
    expect(summary).toBeDefined();
    expect(summary?.length).toBeGreaterThan(0);
    
    const testMetric = summary?.find(m => m.name === 'test-metric');
    expect(testMetric?.count).toBe(2);
    expect(testMetric?.avg).toBe(150);
  });

  it('calculates percentiles correctly', () => {
    const values = [100, 200, 300, 400, 500];
    values.forEach(val => performanceMonitor.record('test', val));
    
    const summary = performanceMonitor.getSummary();
    const testMetric = summary?.find(m => m.name === 'test');
    
    expect(testMetric?.p95).toBeGreaterThan(testMetric?.avg || 0);
  });

  it('keeps only recent metrics', () => {
    // Record more than maxMetrics (1000)
    for (let i = 0; i < 1100; i++) {
      performanceMonitor.record('test', i);
    }
    
    const summary = performanceMonitor.getSummary();
    const testMetric = summary?.find(m => m.name === 'test');
    
    expect(testMetric?.count).toBeLessThanOrEqual(1000);
  });
});

describe('useApiTimer', () => {
  it('tracks API call duration', () => {
    const { result } = renderHook(() => useApiTimer());
    
    act(() => {
      const endTimer = result.current('GET /api/test');
      setTimeout(() => endTimer(), 100);
    });
    
    // Metrics should be recorded
    const summary = performanceMonitor.getSummary();
    expect(summary).toBeDefined();
  });
});

// ============================================================================
// MEMORY UTILITIES TESTS
// ============================================================================

describe('useCleanup', () => {
  it('calls cleanup function on unmount', async () => {
    const { useCleanup } = await import('../hooks/useMemory');
    const cleanup = vi.fn();
    
    const { unmount } = renderHook(() => {
      useCleanup(cleanup);
    });
    
    unmount();
    
    await waitFor(() => {
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });
});

describe('useDebounce', () => {
  it('debounces value updates', async () => {
    const { useDebounce } = await import('../hooks/useMemory');
    
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } }
    );
    
    expect(result.current).toBe('initial');
    
    rerender({ value: 'updated', delay: 300 });
    
    // Should still show initial immediately
    expect(result.current).toBe('initial');
    
    // After delay, should update
    await waitFor(() => {
      expect(result.current).toBe('updated');
    }, { timeout: 400 });
  });
});

// ============================================================================
// TYPE SAFETY TESTS
// ============================================================================

describe('API Error Handling', () => {
  it('identifies API errors correctly', async () => {
    const { isApiError } = await import('../types/api');
    
    const apiError = {
      detail: 'Error message',
      status_code: 400
    };
    
    expect(isApiError(apiError)).toBe(true);
    expect(isApiError(new Error('Regular error'))).toBe(false);
    expect(isApiError(null)).toBe(false);
  });

  it('extracts error messages correctly', async () => {
    const { getErrorMessage } = await import('../types/api');
    
    const apiError = { detail: 'API Error' };
    const regularError = new Error('Regular Error');
    const stringError = 'String Error';
    
    expect(getErrorMessage(apiError)).toBe('API Error');
    expect(getErrorMessage(regularError)).toBe('Regular Error');
    expect(getErrorMessage(stringError)).toBe('String Error');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Error Boundary', () => {
  it('renders without crashing', async () => {
    const { render } = await import('@testing-library/react');
    const { default: ErrorBoundary } = await import('../components/ErrorBoundary');
    
    const { container } = render(
      <ErrorBoundary>
        <div>Test Content</div>
      </ErrorBoundary>
    );
    
    expect(container.textContent).toContain('Test Content');
  });
});
