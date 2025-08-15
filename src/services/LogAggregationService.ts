import fs from 'fs'
import path from 'path'
import { logger } from '../utils/logger'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

export interface LogEntry {
  timestamp: string
  level: string
  message: string
  service?: string
  userId?: string
  requestId?: string
  category?: string
  [key: string]: any
}

export interface LogQuery {
  level?: string
  service?: string
  userId?: string
  category?: string
  startTime?: Date
  endTime?: Date
  limit?: number
  offset?: number
  search?: string
}

export interface LogAggregation {
  totalLogs: number
  logsByLevel: Record<string, number>
  logsByService: Record<string, number>
  logsByCategory: Record<string, number>
  timeRange: {
    start: Date
    end: Date
  }
  topErrors: Array<{
    message: string
    count: number
    lastOccurrence: Date
  }>
  topUsers: Array<{
    userId: string
    count: number
  }>
}

class LogAggregationService {
  private logsDirectory: string
  private logFiles: string[]

  constructor() {
    this.logsDirectory = path.join(process.cwd(), 'logs')
    this.logFiles = [
      'combined.log',
      'error.log',
      'audit.log',
      'performance.log'
    ]
  }

  /**
   * Query logs based on criteria
   */
  async queryLogs(query: LogQuery): Promise<{
    logs: LogEntry[]
    total: number
    hasMore: boolean
  }> {
    try {
      const logs: LogEntry[] = []
      let totalCount = 0
      const limit = query.limit || 100
      const offset = query.offset || 0

      // Determine which log files to search
      const filesToSearch = this.getRelevantLogFiles(query)

      for (const logFile of filesToSearch) {
        const filePath = path.join(this.logsDirectory, logFile)
        
        if (!fs.existsSync(filePath)) {
          continue
        }

        const fileStream = createReadStream(filePath)
        const rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity
        })

        for await (const line of rl) {
          try {
            const logEntry = JSON.parse(line) as LogEntry
            
            if (this.matchesQuery(logEntry, query)) {
              totalCount++
              
              // Apply pagination
              if (totalCount > offset && logs.length < limit) {
                logs.push(logEntry)
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue
          }
        }

        rl.close()
      }

      // Sort logs by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      return {
        logs,
        total: totalCount,
        hasMore: totalCount > offset + limit
      }
    } catch (error) {
      logger.error('Error querying logs', error);
      throw error;
    }
  }

  /**
   * Get log aggregation statistics
   */
  async getLogAggregation(query: LogQuery): Promise<LogAggregation> {
    try {
      const logs: LogEntry[] = []
      const logsByLevel: Record<string, number> = {}
      const logsByService: Record<string, number> = {}
      const logsByCategory: Record<string, number> = {}
      const errorMessages: Record<string, { count: number; lastOccurrence: Date }> = {}
      const userCounts: Record<string, number> = {}

      let minTimestamp = new Date()
      let maxTimestamp = new Date(0)

      // Read all relevant log files
      const filesToSearch = this.getRelevantLogFiles(query)

      for (const logFile of filesToSearch) {
        const filePath = path.join(this.logsDirectory, logFile)
        
        if (!fs.existsSync(filePath)) {
          continue
        }

        const fileStream = createReadStream(filePath)
        const rl = createInterface({
          input: fileStream,
          crlfDelay: Infinity
        })

        for await (const line of rl) {
          try {
            const logEntry = JSON.parse(line) as LogEntry
            
            if (this.matchesQuery(logEntry, query)) {
              logs.push(logEntry)

              // Aggregate by level
              logsByLevel[logEntry.level] = (logsByLevel[logEntry.level] || 0) + 1

              // Aggregate by service
              if (logEntry.service) {
                logsByService[logEntry.service] = (logsByService[logEntry.service] || 0) + 1
              }

              // Aggregate by category
              if (logEntry.category) {
                logsByCategory[logEntry.category] = (logsByCategory[logEntry.category] || 0) + 1
              }

              // Track error messages
              if (logEntry.level === 'error') {
                const message = logEntry.message
                if (!errorMessages[message]) {
                  errorMessages[message] = { count: 0, lastOccurrence: new Date(logEntry.timestamp) }
                }
                errorMessages[message].count++
                const entryTime = new Date(logEntry.timestamp)
                if (entryTime > errorMessages[message].lastOccurrence) {
                  errorMessages[message].lastOccurrence = entryTime
                }
              }

              // Track user activity
              if (logEntry.userId) {
                userCounts[logEntry.userId] = (userCounts[logEntry.userId] || 0) + 1
              }

              // Update time range
              const entryTime = new Date(logEntry.timestamp)
              if (entryTime < minTimestamp) minTimestamp = entryTime
              if (entryTime > maxTimestamp) maxTimestamp = entryTime
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue
          }
        }

        rl.close()
      }

      // Sort and limit top errors
      const topErrors = Object.entries(errorMessages)
        .map(([message, data]) => ({
          message,
          count: data.count,
          lastOccurrence: data.lastOccurrence
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Sort and limit top users
      const topUsers = Object.entries(userCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        totalLogs: logs.length,
        logsByLevel,
        logsByService,
        logsByCategory,
        timeRange: {
          start: minTimestamp,
          end: maxTimestamp
        },
        topErrors,
        topUsers
      }
    } catch (error) {
      logger.error('Error getting log aggregation', error);
      throw error;
    }
  }

  /**
   * Get recent error logs
   */
  async getRecentErrors(limit: number = 50): Promise<LogEntry[]> {
    return this.queryLogs({
      level: 'error',
      limit,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }).then(result => result.logs)
  }

  /**
   * Get performance logs
   */
  async getPerformanceLogs(limit: number = 100): Promise<LogEntry[]> {
    return this.queryLogs({
      category: 'performance',
      limit,
      startTime: new Date(Date.now() - 60 * 60 * 1000) // Last hour
    }).then(result => result.logs)
  }

  /**
   * Get security audit logs
   */
  async getSecurityLogs(limit: number = 100): Promise<LogEntry[]> {
    return this.queryLogs({
      category: 'security',
      limit,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    }).then(result => result.logs)
  }

  /**
   * Get user activity logs
   */
  async getUserActivityLogs(userId: string, limit: number = 100): Promise<LogEntry[]> {
    return this.queryLogs({
      userId,
      limit,
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    }).then(result => result.logs)
  }

  /**
   * Search logs by text
   */
  async searchLogs(searchText: string, limit: number = 100): Promise<LogEntry[]> {
    return this.queryLogs({
      search: searchText,
      limit
    }).then(result => result.logs)
  }

  /**
   * Export logs to file
   */
  async exportLogs(query: LogQuery, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const result = await this.queryLogs({ ...query, limit: 10000 }) // Large limit for export
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `logs-export-${timestamp}.${format}`
      const filepath = path.join(this.logsDirectory, 'exports', filename)

      // Ensure exports directory exists
      const exportsDir = path.dirname(filepath)
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true })
      }

      if (format === 'json') {
        fs.writeFileSync(filepath, JSON.stringify(result.logs, null, 2))
      } else if (format === 'csv') {
        const csvContent = this.convertLogsToCSV(result.logs)
        fs.writeFileSync(filepath, csvContent)
      }

      return filepath
    } catch (error) {
      logger.error('Error exporting logs', error);
      throw error;
    }
  }

  /**
   * Clean old logs
   */
  async cleanOldLogs(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
      
      for (const logFile of this.logFiles) {
        const filePath = path.join(this.logsDirectory, logFile)
        
        if (!fs.existsSync(filePath)) {
          continue
        }

        const stats = fs.statSync(filePath)
        if (stats.mtime < cutoffDate) {
          // Archive old log file
          const archivePath = path.join(this.logsDirectory, 'archive', `${logFile}.${cutoffDate.toISOString().split('T')[0]}`)
          const archiveDir = path.dirname(archivePath)
          
          if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir, { recursive: true })
          }
          
          fs.renameSync(filePath, archivePath)
          logger.info(`Archived old log file: ${logFile}`);
        }
      }
    } catch (error) {
      logger.error('Error cleaning old logs', error);
      throw error;
    }
  }

  // Private helper methods

  private getRelevantLogFiles(query: LogQuery): string[] {
    const files: string[] = []

    if (query.level === 'error') {
      files.push('error.log')
    }

    if (query.category === 'security') {
      files.push('audit.log')
    }

    if (query.category === 'performance') {
      files.push('performance.log')
    }

    // Always include combined.log for general queries
    if (files.length === 0 || query.search) {
      files.push('combined.log')
    }

    return [...new Set(files)] // Remove duplicates
  }

  private matchesQuery(logEntry: LogEntry, query: LogQuery): boolean {
    // Level filter
    if (query.level && logEntry.level !== query.level) {
      return false
    }

    // Service filter
    if (query.service && logEntry.service !== query.service) {
      return false
    }

    // User ID filter
    if (query.userId && logEntry.userId !== query.userId) {
      return false
    }

    // Category filter
    if (query.category && logEntry.category !== query.category) {
      return false
    }

    // Time range filter
    const entryTime = new Date(logEntry.timestamp)
    if (query.startTime && entryTime < query.startTime) {
      return false
    }
    if (query.endTime && entryTime > query.endTime) {
      return false
    }

    // Text search filter
    if (query.search) {
      const searchLower = query.search.toLowerCase()
      const logText = JSON.stringify(logEntry).toLowerCase()
      if (!logText.includes(searchLower)) {
        return false
      }
    }

    return true
  }

  private convertLogsToCSV(logs: LogEntry[]): string {
    if (logs.length === 0) {
      return 'timestamp,level,message,service,userId,category\n'
    }

    // Get all unique keys from logs
    const allKeys = new Set<string>()
    logs.forEach(log => {
      Object.keys(log).forEach(key => allKeys.add(key))
    })

    const headers = Array.from(allKeys).sort()
    const csvRows = [headers.join(',')]

    logs.forEach(log => {
      const row = headers.map(header => {
        const value = log[header]
        if (value === undefined || value === null) {
          return ''
        }
        // Escape commas and quotes in CSV
        const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
        return `"${stringValue.replace(/"/g, '""')}"`
      })
      csvRows.push(row.join(','))
    })

    return csvRows.join('\n')
  }
}

export default new LogAggregationService()