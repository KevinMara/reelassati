interface Statement {
  bind(...values: unknown[]): Statement;
}
interface RecoveryDatabase {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
}

// The one incident Kevin explicitly authorized releasing on 21 October 2026.
// Every identifying field and original bucket must agree. No email is embedded.
const incidentLedger = "b3c01a9a-f46e-4614-a577-768b22d192b1";
const incidentInvocation = "8e3f3eb6-1d85-4fc7-b38d-30b5cdb93099";
const incidentReason = "authorized_canceled_analyzer_20261021";
const incident = `SELECT l.* FROM credit_ledger l JOIN ai_invocations i
  ON i.owner_email = l.owner_email
  WHERE l.owner_email = ? AND l.id = '${incidentLedger}'
    AND l.operation_key = 'video-analysis:0a604089-8ba1-4d53-adf4-438a1985e96b'
    AND l.reference_id = '3fdf0598-7da5-4d71-9d32-02371f3c87c9'
    AND l.created_at = '2026-10-21T14:30:39.884Z'
    AND l.category = 'analysis' AND l.status = 'reserved' AND l.applied = 1
    AND l.amount = -10 AND l.included_amount = 0 AND l.topup_amount = -10
    AND l.settled_at IS NULL
    AND i.id = '${incidentInvocation}' AND i.purpose = 'video-analysis'
    AND i.provider = 'OpenRouter' AND i.model = 'moonshotai/kimi-k3'
    AND i.created_at = '2026-10-21T14:30:40.336Z'
    AND i.input_sha256 = 'de4286a062869efdb92724d1ccb04539203dc576ddbd570e740240844d84dc62'
    AND i.status = 'in_progress' AND i.output_sha256 IS NULL AND i.completed_at IS NULL
    AND EXISTS (SELECT 1 FROM credit_accounts a WHERE a.owner_email = l.owner_email)`;

// Only reservations created by the bounded foreground transport are eligible.
// This is database reconciliation on an authenticated billing read, never a job
// recovery loop, a scheduler, a provider request or a model-using watchdog.
const expired = `SELECT * FROM credit_ledger
  WHERE owner_email = ? AND category = 'analysis' AND status = 'reserved' AND applied = 1
    AND amount < 0 AND included_amount <= 0 AND topup_amount <= 0
    AND included_amount + topup_amount = amount
    AND CASE WHEN json_valid(metadata_json) THEN
      json_extract(metadata_json, '$.analyzerTransport') = 'foreground-v1'
      AND json_type(metadata_json, '$.analyzerDeadlineAt') IN ('integer', 'real')
      AND json_extract(metadata_json, '$.analyzerDeadlineAt') <= ? ELSE 0 END
    AND EXISTS (SELECT 1 FROM credit_accounts a WHERE a.owner_email = credit_ledger.owner_email)`;

export async function reconcileAnalyzerCredits(
  DB: RecoveryDatabase,
  owner: string,
  now = Date.now()
) {
  const stamp = new Date(now).toISOString();
  // D1 batch is atomic. The original hold is released in the same transaction
  // as the bucket restoration; repeated/concurrent reads cannot credit twice.
  await DB.batch([
    DB.prepare(
      `WITH eligible AS (${incident}) UPDATE credit_accounts SET
      included_balance = included_balance - (SELECT included_amount FROM eligible),
      topup_balance = topup_balance - (SELECT topup_amount FROM eligible), updated_at = ?
      WHERE owner_email IN (SELECT owner_email FROM eligible)`
    ).bind(owner, stamp),
    DB.prepare(
      `WITH eligible AS (${incident}) UPDATE credit_ledger SET status = 'released', settled_at = ?,
      metadata_json = json_set(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END,
        '$.recoveryReason', '${incidentReason}', '$.canceledWorkerRequestId', 'b7790667f5260ebf131c3a71c490540a')
      WHERE id IN (SELECT id FROM eligible)`
    ).bind(owner, stamp),
    DB.prepare(
      `UPDATE ai_invocations SET status = 'failed', error_code = 'analysis_request_canceled_reconciled', completed_at = ?
      WHERE id = '${incidentInvocation}' AND owner_email = ? AND status = 'in_progress'
      AND EXISTS (SELECT 1 FROM credit_ledger l WHERE l.id = '${incidentLedger}'
        AND l.owner_email = ai_invocations.owner_email AND l.status = 'released'
        AND json_extract(l.metadata_json, '$.recoveryReason') = '${incidentReason}')`
    ).bind(stamp, owner),
  ]);
  const cutoff = now - 30_000; // leave an explicit grace period for terminal DB writes
  await DB.batch([
    DB.prepare(
      `WITH eligible AS (${expired}) UPDATE credit_accounts SET
      included_balance = included_balance - (SELECT COALESCE(SUM(included_amount), 0) FROM eligible),
      topup_balance = topup_balance - (SELECT COALESCE(SUM(topup_amount), 0) FROM eligible), updated_at = ?
      WHERE owner_email IN (SELECT owner_email FROM eligible)`
    ).bind(owner, cutoff, stamp),
    DB.prepare(
      `WITH eligible AS (${expired}) UPDATE ai_invocations SET status = 'failed',
      error_code = 'analysis_request_expired', completed_at = ? WHERE owner_email = ? AND purpose = 'video-analysis'
      AND status = 'in_progress' AND id IN (SELECT json_extract(metadata_json, '$.analysisInvocationId') FROM eligible)`
    ).bind(owner, cutoff, stamp, owner),
    DB.prepare(
      `WITH eligible AS (${expired}) UPDATE credit_ledger SET status = 'released', settled_at = ?,
      metadata_json = json_set(metadata_json, '$.recoveryReason', 'analysis_request_expired')
      WHERE id IN (SELECT id FROM eligible)`
    ).bind(owner, cutoff, stamp),
  ]);
}

export const analyzerOperationKey = (
  owner: string,
  brand: string,
  requestId: string
) => `video-analysis:${JSON.stringify([owner, brand, requestId])}`;

/** A manual cancellation can only release its authenticated owner's exact hold.
 * A zero-value tombstone also prevents a late reservation from starting a model. */
export async function cancelAnalyzerCredits(
  DB: RecoveryDatabase,
  owner: string,
  brand: string,
  requestId: string
) {
  const key = analyzerOperationKey(owner, brand, requestId);
  const stamp = new Date().toISOString();
  const eligible = `SELECT * FROM credit_ledger WHERE owner_email = ? AND operation_key = ?
    AND category = 'analysis' AND status = 'reserved' AND applied = 1 AND amount < 0
    AND included_amount <= 0 AND topup_amount <= 0 AND included_amount + topup_amount = amount
    AND CASE WHEN json_valid(metadata_json) THEN json_extract(metadata_json, '$.analyzerTransport') = 'foreground-v1' ELSE 0 END
    AND EXISTS (SELECT 1 FROM credit_accounts a WHERE a.owner_email = credit_ledger.owner_email)`;
  await DB.batch([
    DB.prepare(
      `WITH eligible AS (${eligible}) UPDATE credit_accounts SET
      included_balance = included_balance - (SELECT included_amount FROM eligible),
      topup_balance = topup_balance - (SELECT topup_amount FROM eligible), updated_at = ?
      WHERE owner_email IN (SELECT owner_email FROM eligible)`
    ).bind(owner, key, stamp),
    DB.prepare(
      `WITH eligible AS (${eligible}) UPDATE ai_invocations SET status = 'failed',
      error_code = 'analysis_request_canceled', completed_at = ? WHERE owner_email = ? AND purpose = 'video-analysis'
      AND status = 'in_progress' AND id IN (SELECT json_extract(metadata_json, '$.analysisInvocationId') FROM eligible)`
    ).bind(owner, key, stamp, owner),
    DB.prepare(
      `WITH eligible AS (${eligible}) UPDATE credit_ledger SET status = 'released', settled_at = ?,
      metadata_json = json_set(metadata_json, '$.recoveryReason', 'analysis_request_canceled') WHERE id IN (SELECT id FROM eligible)`
    ).bind(owner, key, stamp),
    DB.prepare(
      `INSERT INTO credit_ledger
      (id,owner_email,amount,included_amount,topup_amount,category,status,operation_key,reference_id,description,metadata_json,applied,created_at,settled_at)
      VALUES (?, ?, 0, 0, 0, 'analysis', 'released', ?, NULL, 'Video analysis', ?, 0, ?, ?)
      ON CONFLICT(operation_key) DO NOTHING`
    ).bind(
      crypto.randomUUID(),
      owner,
      key,
      JSON.stringify({
        analyzerTransport: "foreground-v1",
        recoveryReason: "analysis_canceled_before_reservation",
        brandId: brand,
      }),
      stamp,
      stamp
    ),
  ]);
}
