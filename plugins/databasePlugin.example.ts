import { tool } from '@openai/agents';
import { z } from 'zod';
import type { BotPlugin, PluginContext } from '../src/plugins/types.js';

interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
}

/**
 * 数据库查询插件示例
 * 演示如何创建与状态关联的插件
 */
export function createDatabasePlugin(options: {
  connectionString?: string;
}): BotPlugin {
  // 模拟的数据库连接
  const mockDatabase = {
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com', created_at: '2024-01-15' },
      { id: 2, name: 'Bob', email: 'bob@example.com', created_at: '2024-02-20' },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', created_at: '2024-03-10' },
    ],
    posts: [
      { id: 1, user_id: 1, title: 'First Post', content: 'Hello World', created_at: '2024-01-20' },
      { id: 2, user_id: 1, title: 'Second Post', content: 'Learning TS', created_at: '2024-02-01' },
      { id: 3, user_id: 2, title: 'Bob Post', content: 'Great tool', created_at: '2024-02-25' },
    ],
  };

  let isConnected = false;

  return {
    id: 'database',
    name: 'Database Plugin',
    description: 'Query and manage database operations',
    version: '1.0.0',

    setup(context: PluginContext) {
      context.registerTools([
        tool({
          name: 'db_connect',
          description: 'Establish database connection',
          parameters: z.object({
            timeout_ms: z.number().default(5000).describe('Connection timeout in milliseconds'),
          }),
          execute: async (params) => {
            // 模拟连接过程
            await new Promise((resolve) => setTimeout(resolve, 100));
            isConnected = true;
            return {
              success: true,
              message: `Connected to database (timeout: ${params.timeout_ms}ms)`,
              timestamp: new Date().toISOString(),
            };
          },
        }),

        tool({
          name: 'db_query',
          description: 'Execute SQL query against the database',
          parameters: z.object({
            table: z.enum(['users', 'posts']).describe('Table name to query'),
            where: z.object({}).passthrough().optional().describe('Filter conditions'),
            limit: z.number().default(100).describe('Limit results'),
          }),
          execute: (params) => {
            if (!isConnected) {
              return { error: 'Database not connected. Call db_connect first.' };
            }

            const table = mockDatabase[params.table as keyof typeof mockDatabase];
            let results = [...table];

            if (params.where) {
              results = results.filter((row) => {
                return Object.entries(params.where!).every(([key, value]) => {
                  return row[key as keyof typeof row] === value;
                });
              });
            }

            results = results.slice(0, params.limit);

            return {
              success: true,
              table: params.table,
              columns: Object.keys(results[0] || {}),
              rows: results,
              rowCount: results.length,
            };
          },
        }),

        tool({
          name: 'db_insert',
          description: 'Insert a new record into the database',
          parameters: z.object({
            table: z.enum(['users', 'posts']).describe('Table name'),
            data: z.object({}).passthrough().describe('Record data to insert'),
          }),
          execute: (params) => {
            if (!isConnected) {
              return { error: 'Database not connected. Call db_connect first.' };
            }

            const table = mockDatabase[params.table as keyof typeof mockDatabase];
            const newRecord = {
              id: Math.max(...table.map((r: any) => r.id || 0)) + 1,
              ...params.data,
              created_at: new Date().toISOString().split('T')[0],
            };

            (table as any[]).push(newRecord);

            return {
              success: true,
              table: params.table,
              inserted_id: newRecord.id,
              record: newRecord,
            };
          },
        }),

        tool({
          name: 'db_join_query',
          description: 'Execute a join query across tables',
          parameters: z.object({
            left_table: z.enum(['users', 'posts']).describe('Left table'),
            right_table: z.enum(['users', 'posts']).describe('Right table'),
            join_condition: z.string().describe('Join condition (e.g., "users.id = posts.user_id")'),
          }),
          execute: (params) => {
            if (!isConnected) {
              return { error: 'Database not connected' };
            }

            // 简化的join演示
            const results = [];
            const leftTable = mockDatabase[params.left_table as keyof typeof mockDatabase];
            const rightTable = mockDatabase[params.right_table as keyof typeof mockDatabase];

            for (const leftRow of leftTable) {
              for (const rightRow of rightTable) {
                if (
                  (params.join_condition.includes('users.id = posts.user_id') &&
                    (leftRow as any).id === (rightRow as any).user_id) ||
                  (params.join_condition.includes('posts.user_id = users.id') &&
                    (rightRow as any).id === (leftRow as any).user_id)
                ) {
                  results.push({
                    ...leftRow,
                    [`${params.right_table}_${Object.keys(rightRow)[0]}`]: rightRow,
                  });
                }
              }
            }

            return {
              success: true,
              join_condition: params.join_condition,
              rowCount: results.length,
              results: results.slice(0, 10),
            };
          },
        }),

        tool({
          name: 'db_disconnect',
          description: 'Close database connection',
          parameters: z.object({}),
          execute: () => {
            isConnected = false;
            return {
              success: true,
              message: 'Database connection closed',
              timestamp: new Date().toISOString(),
            };
          },
        }),
      ]);
    },

    async start() {
      console.log('Database plugin started, ready for connections');
    },

    async stop() {
      if (isConnected) {
        isConnected = false;
      }
      console.log('Database plugin stopped');
    },
  };
}
