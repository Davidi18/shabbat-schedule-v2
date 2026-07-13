import { Component } from 'react';

// Catches any render/runtime error so a single failure never leaves a white
// screen — the community always sees a graceful message instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('App error boundary caught:', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="web-container">
          <div className="error-card">
            <div className="main-title">שגיאה זמנית</div>
            <p style={{ color: '#666', marginTop: 8 }}>
              משהו השתבש. נסו לרענן את הדף.
            </p>
            <button
              type="button"
              className="btn-action btn-print"
              style={{ marginTop: 14 }}
              onClick={() => window.location.reload()}
            >
              רענון
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
