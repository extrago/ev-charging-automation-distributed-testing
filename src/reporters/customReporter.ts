import * as fs from 'fs';
import * as path from 'path';
import type {
  Reporter,
  Suite,
  TestCase,
  TestResult as PlaywrightTestResult,
} from '@playwright/test/reporter';
import type { TestResult, ReportSummary } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Enterprise Custom Reporter — emits JSON + self-contained HTML
// ─────────────────────────────────────────────────────────────────────────────
interface ReporterOptions {
  outputDir?: string;
}

class EvCustomReporter implements Reporter {
  private readonly outputDir: string;
  private readonly results: TestResult[] = [];
  private suiteStartTime: Date = new Date();

  constructor(options: ReporterOptions = {}) {
    this.outputDir = options.outputDir ?? 'reports';
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  onBegin(_config: unknown, suite: Suite): void {
    this.suiteStartTime = new Date();
    const total = suite.allTests().length;
    console.log(`\n🔌 [EV Reporter] Starting suite — ${total} test(s) discovered`);
  }

  onTestEnd(test: TestCase, result: PlaywrightTestResult): void {
    const ancestors = this.buildAncestors(test);
    const suiteName = ancestors.slice(0, -1).join(' › ') || 'Root Suite';
    const testName = test.title;

    const status = result.status as TestResult['status'];
    const errorMsg = result.errors
      .map((e) => e.message ?? e.toString())
      .join('\n');

    const entry: TestResult = {
      suiteName,
      testName,
      status,
      duration: result.duration,
      error: errorMsg || undefined,
      workerIndex: result.workerIndex,
      retry: result.retry,
      startTime: result.startTime.toISOString(),
    };

    this.results.push(entry);

    const icon = this.statusIcon(status);
    const dur = `${(result.duration / 1000).toFixed(2)}s`;
    console.log(`  ${icon} ${suiteName} › ${testName} [${dur}]`);
    if (errorMsg) {
      console.log(`     ↳ ${errorMsg.split('\n')[0]}`);
    }
  }

  onEnd(result: { status: string }): void {
    const endTime = new Date();
    const summary = this.buildSummary(endTime);

    this.writeJson(summary);
    this.writeHtml(summary);

    const { passed, failed, skipped, timedOut, totalTests, totalDuration } = summary;
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🔌 [EV Reporter] Suite finished — status: ${result.status.toUpperCase()}`);
    console.log(`   ✅ Passed:   ${passed}`);
    console.log(`   ❌ Failed:   ${failed}`);
    console.log(`   ⏩ Skipped:  ${skipped}`);
    console.log(`   ⏱  TimedOut: ${timedOut}`);
    console.log(`   📊 Total:    ${totalTests}`);
    console.log(`   ⏱  Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   📄 Report:   ${path.resolve(this.outputDir, 'report.html')}`);
    console.log(`${'─'.repeat(60)}\n`);
  }

  // ── Private Helpers ────────────────────────────────────────────────────────
  private buildAncestors(test: TestCase): string[] {
    const titles: string[] = [];
    let current: Suite | undefined = test.parent;
    while (current) {
      if (current.title) titles.unshift(current.title);
      current = current.parent;
    }
    titles.push(test.title);
    return titles;
  }

  private buildSummary(endTime: Date): ReportSummary {
    const counts = { passed: 0, failed: 0, skipped: 0, timedOut: 0 };
    for (const r of this.results) {
      if (r.status in counts) counts[r.status]++;
    }
    const totalDuration = this.results.reduce((acc, r) => acc + r.duration, 0);

    return {
      totalTests: this.results.length,
      ...counts,
      totalDuration,
      startTime: this.suiteStartTime.toISOString(),
      endTime: endTime.toISOString(),
      results: this.results,
    };
  }

  private writeJson(summary: ReportSummary): void {
    const filePath = path.join(this.outputDir, 'results.json');
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`\n   📝 JSON report: ${path.resolve(filePath)}`);
  }

  private writeHtml(summary: ReportSummary): void {
    const filePath = path.join(this.outputDir, 'report.html');
    const html = this.buildHtml(summary);
    fs.writeFileSync(filePath, html, 'utf-8');
  }

  private statusIcon(status: string): string {
    const icons: Record<string, string> = {
      passed: '✅',
      failed: '❌',
      skipped: '⏩',
      timedOut: '⏱',
    };
    return icons[status] ?? '❓';
  }

  private statusColor(status: string): string {
    const colors: Record<string, string> = {
      passed: '#22c55e',
      failed: '#ef4444',
      skipped: '#f59e0b',
      timedOut: '#8b5cf6',
    };
    return colors[status] ?? '#6b7280';
  }

  private buildHtml(summary: ReportSummary): string {
    const passRate = summary.totalTests > 0
      ? Math.round((summary.passed / summary.totalTests) * 100)
      : 0;

    const rows = summary.results.map((r) => {
      const color = this.statusColor(r.status);
      const dur = `${(r.duration / 1000).toFixed(2)}s`;
      const errorHtml = r.error
        ? `<div class="error-msg">${this.escapeHtml(r.error.split('\n')[0] ?? '')}</div>`
        : '';
      return `
        <tr class="result-row">
          <td class="suite-col">${this.escapeHtml(r.suiteName)}</td>
          <td class="test-col">${this.escapeHtml(r.testName)}${errorHtml}</td>
          <td><span class="badge" style="background:${color}">${r.status.toUpperCase()}</span></td>
          <td class="dur-col">${dur}</td>
          <td class="worker-col">#${r.workerIndex + 1}</td>
          <td class="retry-col">${r.retry > 0 ? `retry ${r.retry}` : '—'}</td>
        </tr>`;
    }).join('\n');

    const startedAt = new Date(summary.startTime).toLocaleString();
    const endedAt = new Date(summary.endTime).toLocaleString();
    const totalDur = `${(summary.totalDuration / 1000).toFixed(2)}s`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EV Charging Station — Test Report</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }
    header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #334155;
    }
    header .logo { font-size: 2.5rem; }
    header h1  { font-size: 1.6rem; font-weight: 700; color: #f1f5f9; }
    header p   { font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.2rem 1.4rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .stat-card .label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: .08em; color: #64748b; }
    .stat-card .value { font-size: 2rem; font-weight: 700; }
    .progress-bar {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.2rem 1.4rem;
      margin-bottom: 2rem;
    }
    .progress-bar .label { font-size: 0.8rem; color: #94a3b8; margin-bottom: 0.6rem; }
    .bar-track {
      height: 12px;
      background: #0f172a;
      border-radius: 6px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      border-radius: 6px;
      background: linear-gradient(90deg, #10b981, #22c55e);
      transition: width 0.6s ease;
      width: ${passRate}%;
    }
    .table-container {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; }
    thead { background: #0f172a; }
    thead th {
      padding: 0.9rem 1.1rem;
      text-align: left;
      font-size: 0.73rem;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #64748b;
      font-weight: 600;
    }
    .result-row { border-top: 1px solid #1e293b; transition: background 0.15s; }
    .result-row:hover { background: #0f172a; }
    td {
      padding: 0.85rem 1.1rem;
      font-size: 0.88rem;
      vertical-align: top;
      color: #cbd5e1;
    }
    .suite-col { color: #64748b; font-size: 0.8rem; max-width: 220px; }
    .test-col  { font-weight: 500; color: #e2e8f0; }
    .dur-col, .worker-col, .retry-col { color: #64748b; font-size: 0.8rem; white-space: nowrap; }
    .badge {
      display: inline-block;
      padding: 0.2em 0.65em;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: .05em;
      color: #fff;
    }
    .error-msg {
      margin-top: 0.35rem;
      font-size: 0.78rem;
      color: #f87171;
      font-family: 'Cascadia Code', 'Fira Code', monospace;
    }
    footer {
      margin-top: 2rem;
      font-size: 0.78rem;
      color: #475569;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">🔌</div>
    <div>
      <h1>EV Charging Station API — Test Report</h1>
      <p>Started: ${startedAt} &nbsp;|&nbsp; Ended: ${endedAt} &nbsp;|&nbsp; Duration: ${totalDur}</p>
    </div>
  </header>

  <div class="stats">
    <div class="stat-card">
      <span class="label">Total Tests</span>
      <span class="value" style="color:#94a3b8">${summary.totalTests}</span>
    </div>
    <div class="stat-card">
      <span class="label">Passed</span>
      <span class="value" style="color:#22c55e">${summary.passed}</span>
    </div>
    <div class="stat-card">
      <span class="label">Failed</span>
      <span class="value" style="color:#ef4444">${summary.failed}</span>
    </div>
    <div class="stat-card">
      <span class="label">Skipped</span>
      <span class="value" style="color:#f59e0b">${summary.skipped}</span>
    </div>
    <div class="stat-card">
      <span class="label">Timed Out</span>
      <span class="value" style="color:#8b5cf6">${summary.timedOut}</span>
    </div>
    <div class="stat-card">
      <span class="label">Pass Rate</span>
      <span class="value" style="color:${passRate === 100 ? '#22c55e' : '#f59e0b'}">${passRate}%</span>
    </div>
  </div>

  <div class="progress-bar">
    <div class="label">Pass Rate — ${passRate}% (${summary.passed}/${summary.totalTests})</div>
    <div class="bar-track"><div class="bar-fill"></div></div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Suite</th>
          <th>Test</th>
          <th>Status</th>
          <th>Duration</th>
          <th>Worker</th>
          <th>Retry</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <footer>Generated by EV Charging Station Custom Reporter &bull; ${new Date().toISOString()}</footer>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default EvCustomReporter;
