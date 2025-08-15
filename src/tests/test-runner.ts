#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  command: string;
  description: string;
  timeout?: number;
}

interface TestResult {
  suite: string;
  success: boolean;
  duration: number;
  output: string;
  error?: string;
}

class TestRunner {
  private results: TestResult[] = [];

  private testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      command: 'npm run test:unit',
      description: 'Run all unit tests',
      timeout: 60000,
    },
    {
      name: 'Integration Tests',
      command: 'npm run test:integration',
      description: 'Run API and service integration tests',
      timeout: 120000,
    },
    {
      name: 'E2E Tests',
      command: 'npm run test:e2e',
      description: 'Run end-to-end workflow tests',
      timeout: 180000,
    },
    {
      name: 'Smart Contract Tests',
      command: 'npm run test:contracts',
      description: 'Run smart contract tests with Hardhat',
      timeout: 120000,
    },
    {
      name: 'Performance Tests',
      command: 'npm run test:performance',
      description: 'Run load and performance tests',
      timeout: 300000,
    },
    {
      name: 'Blockchain Tests',
      command: 'npm run test:blockchain',
      description: 'Run Hedera blockchain integration tests',
      timeout: 180000,
    },
  ];

  async runSuite(suite: TestSuite): Promise<TestResult> {
    console.log(chalk.blue(`\n🧪 Running ${suite.name}...`));
    console.log(chalk.gray(`Description: ${suite.description}`));
    console.log(chalk.gray(`Command: ${suite.command}`));

    const startTime = Date.now();

    return new Promise((resolve) => {
      const [command, ...args] = suite.command.split(' ');
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let output = '';
      let errorOutput = '';

      process.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Stream output in real-time
        (process.stdout as any).write(text);
      });

      process.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        // Stream error output in real-time
        (process.stderr as any).write(text);
      });

      // Set timeout
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        resolve({
          suite: suite.name,
          success: false,
          duration: Date.now() - startTime,
          output,
          error: 'Test suite timed out',
        });
      }, suite.timeout || 60000);

      process.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;

        resolve({
          suite: suite.name,
          success: code === 0,
          duration,
          output,
          error: code !== 0 ? errorOutput : "",
        });
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          suite: suite.name,
          success: false,
          duration: Date.now() - startTime,
          output,
          error: error.message,
        });
      });
    });
  }

  async runAllSuites(suiteNames?: string[]): Promise<void> {
    console.log(chalk.cyan('🚀 Starting GlobalLand Test Suite'));
    console.log(chalk.gray('─'.repeat(60)));

    const suitesToRun = suiteNames
      ? this.testSuites.filter(suite => suiteNames.includes(suite.name))
      : this.testSuites;

    const startTime = Date.now();

    for (const suite of suitesToRun) {
      const result = await this.runSuite(suite);
      this.results.push(result);

      if (result.success) {
        console.log(chalk.green(`✅ ${suite.name} passed (${result.duration}ms)`));
      } else {
        console.log(chalk.red(`❌ ${suite.name} failed (${result.duration}ms)`));
        if (result.error) {
          console.log(chalk.red(`   Error: ${result.error}`));
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    this.printSummary(totalDuration);
    this.generateReport();
  }

  private printSummary(totalDuration: number): void {
    console.log(chalk.cyan('\n📊 Test Summary'));
    console.log(chalk.gray('─'.repeat(60)));

    const totalSuites = this.results.length;
    const passedSuites = this.results.filter(r => r.success).length;
    const failedSuites = totalSuites - passedSuites;
    const successRate = ((passedSuites / totalSuites) * 100).toFixed(1);

    console.log(`Total Suites: ${totalSuites}`);
    console.log(`Passed: ${chalk.green(passedSuites)}`);
    console.log(`Failed: ${chalk.red(failedSuites)}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log(`Total Duration: ${totalDuration}ms`);

    if (failedSuites > 0) {
      console.log(chalk.yellow('\n⚠️  Failed Suites:'));
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(chalk.red(`  • ${result.suite}: ${result.error || 'Unknown error'}`));
        });
    }

    const overallStatus = failedSuites === 0 
      ? chalk.green('✅ ALL TESTS PASSED') 
      : chalk.red('❌ SOME TESTS FAILED');
    
    console.log(`\n${overallStatus}`);
  }

  private generateReport(): void {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: this.results.length,
        passedSuites: this.results.filter(r => r.success).length,
        failedSuites: this.results.filter(r => !r.success).length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0),
      },
      results: this.results.map(result => ({
        suite: result.suite,
        success: result.success,
        duration: result.duration,
        error: result.error,
      })),
    };

    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Write JSON report
    const reportPath = path.join(reportsDir, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    // Write HTML report
    const htmlReport = this.generateHtmlReport(reportData);
    const htmlReportPath = path.join(reportsDir, `test-report-${Date.now()}.html`);
    fs.writeFileSync(htmlReportPath, htmlReport);

    console.log(chalk.cyan(`\n📄 Reports generated:`));
    console.log(chalk.gray(`  JSON: ${reportPath}`));
    console.log(chalk.gray(`  HTML: ${htmlReportPath}`));
  }

  private generateHtmlReport(data: any): string {
    const successRate = ((data.summary.passedSuites / data.summary.totalSuites) * 100).toFixed(1);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>GlobalLand Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 14px; }
        .success { color: #10b981; }
        .error { color: #ef4444; }
        .results { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .result-item { padding: 15px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
        .result-item:last-child { border-bottom: none; }
        .result-name { font-weight: 500; }
        .result-duration { color: #666; font-size: 14px; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        .status-success { background: #d1fae5; color: #065f46; }
        .status-failed { background: #fee2e2; color: #991b1b; }
    </style>
</head>
<body>
    <div class="header">
        <h1>GlobalLand Test Report</h1>
        <p>Generated on ${new Date(data.timestamp).toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value">${data.summary.totalSuites}</div>
            <div class="metric-label">Total Suites</div>
        </div>
        <div class="metric">
            <div class="metric-value success">${data.summary.passedSuites}</div>
            <div class="metric-label">Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value error">${data.summary.failedSuites}</div>
            <div class="metric-label">Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${successRate}%</div>
            <div class="metric-label">Success Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value">${data.summary.totalDuration}ms</div>
            <div class="metric-label">Total Duration</div>
        </div>
    </div>
    
    <div class="results">
        <h2 style="padding: 20px; margin: 0; background: #f8f9fa; border-bottom: 1px solid #e5e7eb;">Test Results</h2>
        ${data.results.map(result => `
            <div class="result-item">
                <div>
                    <div class="result-name">${result.suite}</div>
                    ${result.error ? `<div style="color: #ef4444; font-size: 14px; margin-top: 4px;">${result.error}</div>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="result-duration">${result.duration}ms</span>
                    <span class="status-badge ${result.success ? 'status-success' : 'status-failed'}">
                        ${result.success ? 'PASSED' : 'FAILED'}
                    </span>
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>`;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  if (args.length > 0) {
    // Run specific test suites
    runner.runAllSuites(args).catch(error => {
      console.error(chalk.red('Test runner failed:'), error);
      process.exit(1);
    });
  } else {
    // Run all test suites
    runner.runAllSuites().catch(error => {
      console.error(chalk.red('Test runner failed:'), error);
      process.exit(1);
    });
  }
}

export { TestRunner };