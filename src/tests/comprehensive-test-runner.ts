#!/usr/bin/env node

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import chalk from 'chalk'

interface TestSuite {
  name: string
  command: string
  args: string[]
  description: string
  required: boolean
}

class ComprehensiveTestRunner {
  private testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      command: 'npm',
      args: ['run', 'test:unit'],
      description: 'Run all unit tests for services, controllers, and utilities',
      required: true
    },
    {
      name: 'Integration Tests',
      command: 'npm',
      args: ['run', 'test:integration'],
      description: 'Run integration tests for API endpoints and database operations',
      required: true
    },
    {
      name: 'Smart Contract Tests',
      command: 'npx',
      args: ['hardhat', 'test'],
      description: 'Run smart contract tests using Hardhat',
      required: true
    },
    {
      name: 'End-to-End Tests',
      command: 'npm',
      args: ['run', 'test:e2e'],
      description: 'Run end-to-end tests for critical user flows',
      required: true
    },
    {
      name: 'Performance Tests',
      command: 'npm',
      args: ['run', 'test:performance'],
      description: 'Run performance and load tests',
      required: false
    },
    {
      name: 'Blockchain Integration Tests',
      command: 'npm',
      args: ['run', 'test:blockchain'],
      description: 'Run blockchain integration tests with Hedera',
      required: true
    },
    {
      name: 'Security Tests',
      command: 'npm',
      args: ['run', 'test:security'],
      description: 'Run security and vulnerability tests',
      required: false
    },
    {
      name: 'API Tests',
      command: 'npm',
      args: ['run', 'test:api'],
      description: 'Run comprehensive API endpoint tests',
      required: true
    }
  ]

  private results: Map<string, { success: boolean; duration: number; output: string }> = new Map()

  async runAllTests(options: { 
    skipOptional?: boolean
    parallel?: boolean
    verbose?: boolean
    coverage?: boolean
  } = {}) {
    console.log(chalk.blue.bold('🧪 Starting Comprehensive Test Suite'))
    console.log(chalk.gray('=' .repeat(60)))

    const startTime = Date.now()
    
    // Filter test suites based on options
    const suitesToRun = this.testSuites.filter(suite => 
      !options.skipOptional || suite.required
    )

    if (options.parallel) {
      await this.runTestsInParallel(suitesToRun, options)
    } else {
      await this.runTestsSequentially(suitesToRun, options)
    }

    const totalDuration = Date.now() - startTime
    this.printSummary(totalDuration)
  }

  private async runTestsSequentially(
    suites: TestSuite[], 
    options: { verbose?: boolean; coverage?: boolean }
  ) {
    for (const suite of suites) {
      console.log(chalk.yellow(`\n📋 Running ${suite.name}...`))
      console.log(chalk.gray(`   ${suite.description}`))
      
      const result = await this.runSingleTest(suite, options)
      this.results.set(suite.name, result)
      
      if (result.success) {
        console.log(chalk.green(`✅ ${suite.name} passed (${result.duration}ms)`))
      } else {
        console.log(chalk.red(`❌ ${suite.name} failed (${result.duration}ms)`))
        if (options.verbose) {
          console.log(chalk.red(result.output))
        }
      }
    }
  }

  private async runTestsInParallel(
    suites: TestSuite[], 
    options: { verbose?: boolean; coverage?: boolean }
  ) {
    console.log(chalk.yellow(`\n🚀 Running ${suites.length} test suites in parallel...`))
    
    const promises = suites.map(async (suite) => {
      const result = await this.runSingleTest(suite, options)
      this.results.set(suite.name, result)
      return { suite, result }
    })

    const results = await Promise.all(promises)
    
    results.forEach(({ suite, result }) => {
      if (result.success) {
        console.log(chalk.green(`✅ ${suite.name} passed (${result.duration}ms)`))
      } else {
        console.log(chalk.red(`❌ ${suite.name} failed (${result.duration}ms)`))
      }
    })
  }

  private async runSingleTest(
    suite: TestSuite, 
    options: { verbose?: boolean; coverage?: boolean }
  ): Promise<{ success: boolean; duration: number; output: string }> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      let output = ''

      // Add coverage flag if requested
      const args = [...suite.args]
      if (options.coverage && suite.command === 'npm') {
        args.push('--', '--coverage')
      }

      const childProcess = spawn(suite.command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      })

      childProcess.stdout.on('data', (data) => {
        output += data.toString()
        if (options.verbose) {
          console.log(chalk.gray(data.toString()))
        }
      })

      childProcess.stderr.on('data', (data) => {
        output += data.toString()
        if (options.verbose) {
          console.error(chalk.red(data.toString()))
        }
      })

      childProcess.on('close', (code) => {
        const duration = Date.now() - startTime
        resolve({
          success: code === 0,
          duration,
          output
        })
      })

      childProcess.on('error', (error) => {
        const duration = Date.now() - startTime
        resolve({
          success: false,
          duration,
          output: error.message
        })
      })
    })
  }

  private printSummary(totalDuration: number) {
    console.log(chalk.blue.bold('\n📊 Test Summary'))
    console.log(chalk.gray('=' .repeat(60)))

    const passed = Array.from(this.results.values()).filter(r => r.success).length
    const failed = Array.from(this.results.values()).filter(r => !r.success).length
    const total = this.results.size

    console.log(chalk.green(`✅ Passed: ${passed}`))
    console.log(chalk.red(`❌ Failed: ${failed}`))
    console.log(chalk.blue(`📈 Total: ${total}`))
    console.log(chalk.yellow(`⏱️  Duration: ${totalDuration}ms`))

    if (failed > 0) {
      console.log(chalk.red.bold('\n❌ Failed Test Suites:'))
      this.results.forEach((result, name) => {
        if (!result.success) {
          console.log(chalk.red(`   • ${name}`))
        }
      })
    }

    const successRate = (passed / total) * 100
    if (successRate === 100) {
      console.log(chalk.green.bold('\n🎉 All tests passed!'))
    } else if (successRate >= 80) {
      console.log(chalk.yellow.bold(`\n⚠️  ${successRate.toFixed(1)}% tests passed`))
    } else {
      console.log(chalk.red.bold(`\n💥 Only ${successRate.toFixed(1)}% tests passed`))
    }

    console.log(chalk.gray('=' .repeat(60)))
  }

  async runSpecificSuite(suiteName: string, options: { verbose?: boolean } = {}) {
    const suite = this.testSuites.find(s => 
      s.name.toLowerCase().includes(suiteName.toLowerCase())
    )

    if (!suite) {
      console.log(chalk.red(`❌ Test suite '${suiteName}' not found`))
      console.log(chalk.yellow('Available suites:'))
      this.testSuites.forEach(s => {
        console.log(chalk.gray(`   • ${s.name}`))
      })
      return
    }

    console.log(chalk.blue.bold(`🧪 Running ${suite.name}`))
    console.log(chalk.gray(`   ${suite.description}`))

    const result = await this.runSingleTest(suite, options)
    
    if (result.success) {
      console.log(chalk.green(`✅ ${suite.name} passed (${result.duration}ms)`))
    } else {
      console.log(chalk.red(`❌ ${suite.name} failed (${result.duration}ms)`))
      console.log(chalk.red(result.output))
    }
  }

  listSuites() {
    console.log(chalk.blue.bold('📋 Available Test Suites'))
    console.log(chalk.gray('=' .repeat(60)))

    this.testSuites.forEach((suite, index) => {
      const status = suite.required ? chalk.red('required') : chalk.yellow('optional')
      console.log(chalk.white(`${index + 1}. ${chalk.bold(suite.name)} (${status})`))
      console.log(chalk.gray(`   ${suite.description}`))
      console.log(chalk.gray(`   Command: ${suite.command} ${suite.args.join(' ')}`))
      console.log()
    })
  }

  async checkPrerequisites(): Promise<boolean> {
    console.log(chalk.blue.bold('🔍 Checking Test Prerequisites'))
    console.log(chalk.gray('=' .repeat(60)))

    const checks = [
      {
        name: 'Node.js',
        check: () => process.version,
        required: true
      },
      {
        name: 'npm',
        check: () => this.commandExists('npm'),
        required: true
      },
      {
        name: 'PostgreSQL Test Database',
        check: () => process.env.TEST_DB_HOST || 'localhost',
        required: true
      },
      {
        name: 'Redis Test Instance',
        check: () => process.env.TEST_REDIS_HOST || 'localhost',
        required: true
      },
      {
        name: 'Hedera Test Credentials',
        check: () => process.env.TEST_HEDERA_ACCOUNT_ID && process.env.TEST_HEDERA_PRIVATE_KEY,
        required: true
      },
      {
        name: 'Hardhat',
        check: () => this.commandExists('npx hardhat'),
        required: true
      },
      {
        name: 'Test Environment File',
        check: () => existsSync('.env.test'),
        required: false
      }
    ]

    let allPassed = true

    for (const check of checks) {
      try {
        const result = await check.check()
        if (result) {
          console.log(chalk.green(`✅ ${check.name}: OK`))
        } else {
          console.log(chalk.red(`❌ ${check.name}: Missing`))
          if (check.required) allPassed = false
        }
      } catch (error) {
        console.log(chalk.red(`❌ ${check.name}: Error - ${error}`))
        if (check.required) allPassed = false
      }
    }

    if (!allPassed) {
      console.log(chalk.red.bold('\n💥 Some required prerequisites are missing!'))
      console.log(chalk.yellow('Please ensure all required dependencies are installed and configured.'))
    } else {
      console.log(chalk.green.bold('\n🎉 All prerequisites are satisfied!'))
    }

    return allPassed
  }

  private commandExists(command: string): boolean {
    try {
      require('child_process').execSync(`which ${command}`, { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
}

// CLI Interface
async function main() {
  const runner = new ComprehensiveTestRunner()
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(chalk.blue.bold('🧪 Comprehensive Test Runner'))
    console.log(chalk.gray('Usage: npm run test:comprehensive [options] [suite-name]'))
    console.log()
    console.log(chalk.yellow('Options:'))
    console.log('  --help, -h          Show this help message')
    console.log('  --list, -l          List all available test suites')
    console.log('  --check, -c         Check prerequisites')
    console.log('  --parallel, -p      Run tests in parallel')
    console.log('  --skip-optional     Skip optional test suites')
    console.log('  --verbose, -v       Show detailed output')
    console.log('  --coverage          Generate coverage reports')
    console.log()
    console.log(chalk.yellow('Examples:'))
    console.log('  npm run test:comprehensive')
    console.log('  npm run test:comprehensive --parallel --coverage')
    console.log('  npm run test:comprehensive unit')
    console.log('  npm run test:comprehensive --check')
    return
  }

  if (args.includes('--list') || args.includes('-l')) {
    runner.listSuites()
    return
  }

  if (args.includes('--check') || args.includes('-c')) {
    await runner.checkPrerequisites()
    return
  }

  // Check for specific suite name
  const suiteName = args.find(arg => !arg.startsWith('--'))
  if (suiteName) {
    await runner.runSpecificSuite(suiteName, {
      verbose: args.includes('--verbose') || args.includes('-v')
    })
    return
  }

  // Run all tests
  const options = {
    parallel: args.includes('--parallel') || args.includes('-p'),
    skipOptional: args.includes('--skip-optional'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    coverage: args.includes('--coverage')
  }

  const prerequisitesPassed = await runner.checkPrerequisites()
  if (!prerequisitesPassed) {
    console.log(chalk.red('\n❌ Prerequisites check failed. Please fix the issues above.'))
    process.exit(1)
  }

  await runner.runAllTests(options)
}

if (require.main === module) {
  main().catch(console.error)
}

export { ComprehensiveTestRunner }