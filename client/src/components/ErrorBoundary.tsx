import { Component, type ErrorInfo, type ReactNode } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
        
        // Log error to backend for monitoring
        this.logErrorToBackend(error, errorInfo);
    }

    private async logErrorToBackend(error: Error, errorInfo: ErrorInfo) {
        try {
            await axios.post(`${API_URL}/frontend-errors`, {
                error_message: error.message,
                stack_trace: errorInfo.componentStack || error.stack,
                url: window.location.href,
                user_agent: navigator.userAgent
            });
            console.log('[ErrorBoundary] Error logged to backend');
        } catch (logError) {
            console.error('[ErrorBoundary] Failed to log error to backend:', logError);
        }
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-red-50 p-10 font-mono text-sm">
                    <div className="max-w-4xl w-full bg-white border border-red-200 shadow-xl rounded-lg p-8 overflow-hidden">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong.</h1>
                        <p className="text-slate-600 mb-4">The error has been logged. Try reloading the page.</p>
                        <div className="bg-red-50 border border-red-100 rounded p-4 mb-4">
                            <p className="font-bold text-red-800 break-words">{this.state.error && this.state.error.toString()}</p>
                        </div>
                        <div className="bg-slate-900 text-slate-300 p-4 rounded overflow-auto max-h-96 text-xs whitespace-pre-wrap">
                            {this.state.errorInfo?.componentStack}
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
