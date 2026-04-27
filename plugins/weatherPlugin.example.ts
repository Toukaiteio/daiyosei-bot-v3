import { tool } from '@openai/agents';
import { z } from 'zod';
import type { BotPlugin, PluginContext } from '../src/plugins/types.js';

/**
 * 天气插件示例
 * 提供天气查询和天气预报相关的工具
 */
export function createWeatherPlugin(): BotPlugin {
  return {
    id: 'weather',
    name: 'Weather Plugin',
    description: 'Provides weather information and forecasting capabilities',
    version: '1.0.0',

    setup(context: PluginContext) {
      context.registerTools([
        tool({
          name: 'get_current_weather',
          description: 'Get current weather information for a city',
          parameters: z.object({
            city: z.string().describe('City name'),
            unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature unit'),
          }),
          execute: async (params) => {
            // 这里应该调用真实的天气API
            // 示例：调用 OpenWeatherMap 或其他服务
            const mockWeatherData = {
              city: params.city,
              temperature: 22,
              unit: params.unit,
              condition: 'Partly Cloudy',
              humidity: 65,
              wind_speed: 12,
              description: `Current weather in ${params.city}: Partly cloudy, 22°C, 65% humidity`,
            };
            return mockWeatherData;
          },
        }),

        tool({
          name: 'get_weather_forecast',
          description: 'Get weather forecast for the next 7 days',
          parameters: z.object({
            city: z.string().describe('City name'),
            days: z.number().min(1).max(7).default(3).describe('Number of days to forecast'),
          }),
          execute: async (params) => {
            // 模拟7天天气预报数据
            const forecast = Array.from({ length: params.days }, (_, i) => ({
              day: i + 1,
              date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
              high: 25 - i,
              low: 18 - i,
              condition: ['Sunny', 'Cloudy', 'Rainy'][i % 3],
            }));
            return {
              city: params.city,
              forecast,
            };
          },
        }),

        tool({
          name: 'get_weather_alerts',
          description: 'Get weather alerts and warnings for a city',
          parameters: z.object({
            city: z.string().describe('City name'),
          }),
          execute: async (params) => {
            // 模拟天气警报
            return {
              city: params.city,
              alerts: [
                {
                  type: 'High Temperature Warning',
                  severity: 'moderate',
                  description: 'High temperature expected this weekend',
                  expiration: new Date(Date.now() + 86400000).toISOString(),
                },
              ],
              hasAlerts: true,
            };
          },
        }),
      ]);
    },

    async start() {
      console.log('Weather plugin started');
      // 可以在这里初始化数据库连接或定时任务
    },

    async stop() {
      console.log('Weather plugin stopped');
      // 清理资源
    },
  };
}
