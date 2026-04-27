import { tool } from '@openai/agents';
import { z } from 'zod';
import type { AgentSkill } from '../src/skills/types.js';

/**
 * 文本处理技能示例
 * 演示如何创建多个相关工具组成一个技能
 */
export function createTextProcessingSkill(): AgentSkill {
  return {
    id: 'text.processing',
    name: 'Text Processing',
    description: 'Advanced text analysis and manipulation tools',
    version: '1.0.0',
    permissions: ['text:read', 'text:analyze'],

    tools() {
      return [
        tool({
          name: 'analyze_text',
          description: 'Analyze text and return statistics',
          parameters: z.object({
            text: z.string().describe('Text to analyze'),
            analysis_type: z.enum(['basic', 'detailed']).default('basic').describe('Type of analysis'),
          }),
          execute: (params) => {
            const words = params.text.trim().split(/\s+/);
            const sentences = params.text.split(/[.!?]+/).filter((s) => s.trim());
            const chars = params.text.length;
            const charsNoSpace = params.text.replace(/\s/g, '').length;

            const basic = {
              character_count: chars,
              character_count_no_space: charsNoSpace,
              word_count: words.length,
              sentence_count: sentences.length,
              average_word_length: (charsNoSpace / words.length).toFixed(2),
            };

            if (params.analysis_type === 'basic') {
              return basic;
            }

            // 详细分析
            const wordFreq: Record<string, number> = {};
            words.forEach((word) => {
              const normalized = word.toLowerCase();
              wordFreq[normalized] = (wordFreq[normalized] || 0) + 1;
            });

            const topWords = Object.entries(wordFreq)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([word, count]) => ({ word, count }));

            return {
              ...basic,
              unique_words: Object.keys(wordFreq).length,
              top_words: topWords,
              reading_time_minutes: Math.ceil(words.length / 200),
            };
          },
        }),

        tool({
          name: 'text_transform',
          description: 'Transform text (case conversion, trimming, etc)',
          parameters: z.object({
            text: z.string().describe('Text to transform'),
            operation: z.enum(['uppercase', 'lowercase', 'capitalize', 'reverse', 'remove_duplicates']).describe('Transform operation'),
          }),
          execute: (params) => {
            let result: string;
            switch (params.operation) {
              case 'uppercase':
                result = params.text.toUpperCase();
                break;
              case 'lowercase':
                result = params.text.toLowerCase();
                break;
              case 'capitalize':
                result = params.text
                  .split(' ')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
                break;
              case 'reverse':
                result = params.text.split('').reverse().join('');
                break;
              case 'remove_duplicates':
                // 移除连续重复的单词
                const words = params.text.split(/\s+/);
                result = words.filter((word, i) => word !== words[i - 1]).join(' ');
                break;
            }
            return {
              operation: params.operation,
              original_length: params.text.length,
              result,
              result_length: result.length,
            };
          },
        }),

        tool({
          name: 'text_search',
          description: 'Search for patterns in text',
          parameters: z.object({
            text: z.string().describe('Text to search in'),
            pattern: z.string().describe('Pattern to search for (supports regex)'),
            case_sensitive: z.boolean().default(false).describe('Case sensitive search'),
          }),
          execute: (params) => {
            try {
              const flags = params.case_sensitive ? 'g' : 'gi';
              const regex = new RegExp(params.pattern, flags);
              const matches = params.text.match(regex) || [];

              return {
                pattern: params.pattern,
                match_count: matches.length,
                matches: matches.slice(0, 50), // 限制返回50个结果
                positions: Array.from(params.text.matchAll(new RegExp(params.pattern, flags)))
                  .slice(0, 50)
                  .map((m) => ({
                    match: m[0],
                    index: m.index,
                  })),
              };
            } catch (error) {
              return {
                error: `Invalid regex pattern: ${error}`,
              };
            }
          },
        }),

        tool({
          name: 'extract_entities',
          description: 'Extract specific entities from text (emails, URLs, numbers)',
          parameters: z.object({
            text: z.string().describe('Text to extract from'),
            entity_types: z.array(z.enum(['emails', 'urls', 'numbers', 'mentions', 'hashtags'])).describe('Entity types to extract'),
          }),
          execute: (params) => {
            const results: Record<string, string[]> = {};

            if (params.entity_types.includes('emails')) {
              const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
              results.emails = params.text.match(emailRegex) || [];
            }

            if (params.entity_types.includes('urls')) {
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              results.urls = params.text.match(urlRegex) || [];
            }

            if (params.entity_types.includes('numbers')) {
              const numberRegex = /\b\d+(?:\.\d+)?\b/g;
              results.numbers = params.text.match(numberRegex) || [];
            }

            if (params.entity_types.includes('mentions')) {
              const mentionRegex = /@[^\s]+/g;
              results.mentions = params.text.match(mentionRegex) || [];
            }

            if (params.entity_types.includes('hashtags')) {
              const hashtagRegex = /#[^\s]+/g;
              results.hashtags = params.text.match(hashtagRegex) || [];
            }

            return {
              text_length: params.text.length,
              entities_found: Object.keys(results).filter((k) => results[k].length > 0),
              ...results,
            };
          },
        }),

        tool({
          name: 'text_similarity',
          description: 'Calculate similarity between two texts (using simple comparison)',
          parameters: z.object({
            text1: z.string().describe('First text'),
            text2: z.string().describe('Second text'),
            algorithm: z.enum(['word_overlap', 'character_overlap']).default('word_overlap').describe('Comparison algorithm'),
          }),
          execute: (params) => {
            if (params.algorithm === 'word_overlap') {
              const words1 = new Set(params.text1.toLowerCase().split(/\s+/));
              const words2 = new Set(params.text2.toLowerCase().split(/\s+/));

              const intersection = new Set([...words1].filter((w) => words2.has(w)));
              const union = new Set([...words1, ...words2]);

              const similarity = (intersection.size / union.size) * 100;
              return {
                algorithm: 'word_overlap',
                text1_words: words1.size,
                text2_words: words2.size,
                common_words: intersection.size,
                similarity_percentage: similarity.toFixed(2),
              };
            } else {
              // 字符级别的Levenshtein距离简化版本
              const str1 = params.text1.toLowerCase();
              const str2 = params.text2.toLowerCase();
              const maxLen = Math.max(str1.length, str2.length);
              const distance = str1.localeCompare(str2) === 0 ? 0 : maxLen;
              const similarity = ((maxLen - distance) / maxLen) * 100;

              return {
                algorithm: 'character_overlap',
                text1_length: str1.length,
                text2_length: str2.length,
                similarity_percentage: similarity.toFixed(2),
              };
            }
          },
        }),
      ];
    },
  };
}
