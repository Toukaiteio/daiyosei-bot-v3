import { tool } from '@openai/agents';
import { z } from 'zod';
import type { AgentSkill } from '../src/skills/types.js';

/**
 * 数学计算技能示例
 * 提供基础和高级数学运算功能
 */
export function createMathSkill(): AgentSkill {
  return {
    id: 'math.calculation',
    name: 'Math Calculation',
    description: 'Provides mathematical calculation and equation solving tools',
    version: '1.0.0',
    permissions: ['math:compute'],

    tools() {
      return [
        tool({
          name: 'basic_arithmetic',
          description: 'Perform basic arithmetic operations (add, subtract, multiply, divide)',
          parameters: z.object({
            a: z.number().describe('First number'),
            b: z.number().describe('Second number'),
            operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('Operation to perform'),
          }),
          execute: (params) => {
            let result: number;
            switch (params.operation) {
              case 'add':
                result = params.a + params.b;
                break;
              case 'subtract':
                result = params.a - params.b;
                break;
              case 'multiply':
                result = params.a * params.b;
                break;
              case 'divide':
                if (params.b === 0) {
                  return { error: 'Division by zero' };
                }
                result = params.a / params.b;
                break;
            }
            return {
              operation: params.operation,
              a: params.a,
              b: params.b,
              result,
            };
          },
        }),

        tool({
          name: 'advanced_math',
          description: 'Perform advanced mathematical functions (sqrt, power, logarithm)',
          parameters: z.object({
            x: z.number().describe('Input number'),
            operation: z.enum(['sqrt', 'square', 'cube', 'log', 'exp']).describe('Mathematical function'),
          }),
          execute: (params) => {
            let result: number;
            try {
              switch (params.operation) {
                case 'sqrt':
                  if (params.x < 0) {
                    return { error: 'Cannot take square root of negative number' };
                  }
                  result = Math.sqrt(params.x);
                  break;
                case 'square':
                  result = params.x * params.x;
                  break;
                case 'cube':
                  result = params.x * params.x * params.x;
                  break;
                case 'log':
                  if (params.x <= 0) {
                    return { error: 'Logarithm undefined for non-positive numbers' };
                  }
                  result = Math.log(params.x);
                  break;
                case 'exp':
                  result = Math.exp(params.x);
                  break;
              }
              return {
                operation: params.operation,
                input: params.x,
                result,
              };
            } catch (error) {
              return { error: String(error) };
            }
          },
        }),

        tool({
          name: 'statistical_analysis',
          description: 'Calculate statistics from a list of numbers',
          parameters: z.object({
            numbers: z.array(z.number()).min(1).describe('Array of numbers to analyze'),
            functions: z.array(z.enum(['mean', 'median', 'std_dev', 'min', 'max'])).default(['mean']).describe('Statistical functions to compute'),
          }),
          execute: (params) => {
            const sorted = [...params.numbers].sort((a, b) => a - b);
            const n = params.numbers.length;
            const results: Record<string, number> = {};

            if (params.functions.includes('mean')) {
              results.mean = params.numbers.reduce((a, b) => a + b, 0) / n;
            }

            if (params.functions.includes('median')) {
              results.median = n % 2 === 0
                ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
                : sorted[Math.floor(n / 2)];
            }

            if (params.functions.includes('min')) {
              results.min = Math.min(...params.numbers);
            }

            if (params.functions.includes('max')) {
              results.max = Math.max(...params.numbers);
            }

            if (params.functions.includes('std_dev')) {
              const mean = params.numbers.reduce((a, b) => a + b, 0) / n;
              const variance = params.numbers.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / n;
              results.std_dev = Math.sqrt(variance);
            }

            return {
              count: n,
              results,
            };
          },
        }),

        tool({
          name: 'solve_quadratic',
          description: 'Solve quadratic equations (ax² + bx + c = 0)',
          parameters: z.object({
            a: z.number().describe('Coefficient a'),
            b: z.number().describe('Coefficient b'),
            c: z.number().describe('Coefficient c'),
          }),
          execute: (params) => {
            if (params.a === 0) {
              return { error: 'Coefficient a cannot be zero for quadratic equation' };
            }

            const discriminant = params.b * params.b - 4 * params.a * params.c;

            if (discriminant < 0) {
              return {
                real_solutions: false,
                message: 'No real solutions (discriminant is negative)',
              };
            }

            const sqrt_discriminant = Math.sqrt(discriminant);
            const x1 = (-params.b + sqrt_discriminant) / (2 * params.a);
            const x2 = (-params.b - sqrt_discriminant) / (2 * params.a);

            return {
              real_solutions: true,
              solutions: discriminant === 0 ? [x1] : [x1, x2],
              discriminant,
            };
          },
        }),
      ];
    },
  };
}
