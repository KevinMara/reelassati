'use client';

export default function DebugPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Deployment Debug</h1>
      <p><strong>Commit:</strong> 0b4bd8fb16720c6430a75f71a98a2dd667c063bd</p>
      <p><strong>Timestamp:</strong> {new Date().toISOString()}</p>
      <p><strong>Status:</strong> Dashboard Restored & Auth Fixed</p>
      <hr />
      <p>If you see this page on production, the deployment is active.</p>
    </div>
  );
}
