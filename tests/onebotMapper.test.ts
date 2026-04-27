import { describe, expect, it } from 'vitest';
import { mapOneBotEvent } from '../src/adapters/onebot/mapper.js';

describe('mapOneBotEvent', () => {
  it('maps OneBot text messages into internal bot messages', () => {
    const message = mapOneBotEvent({
      post_type: 'message',
      message_type: 'group',
      self_id: 123,
      user_id: 456,
      group_id: 789,
      message_id: 1,
      message: [{ type: 'text', data: { text: 'hello' } }],
    });

    expect(message?.type).toBe('group');
    expect(message?.text).toBe('hello');
    expect(message?.userId).toBe('456');
    expect(message?.groupId).toBe('789');
  });

  it('keeps image segment urls decoded when array messages have no text segment', () => {
    const message = mapOneBotEvent({
      post_type: 'message',
      message_type: 'group',
      message_id: 2,
      message: [
        {
          type: 'image',
          data: {
            file: 'abc.jpg',
            url: 'https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=file-id&rkey=key',
          },
        },
      ],
      raw_message:
        '[CQ:image,file=abc.jpg,url=https://multimedia.nt.qq.com.cn/download?appid=1407&amp;fileid=file-id&amp;rkey=key]',
    });

    expect(message?.text).toBe(
      '[image file="abc.jpg" url="https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=file-id&rkey=key"]',
    );
  });

  it('parses CQ image strings into image segments and decodes html entities', () => {
    const message = mapOneBotEvent({
      post_type: 'message',
      message_type: 'group',
      message_id: 3,
      message:
        '[CQ:image,file=abc.jpg,url=https://multimedia.nt.qq.com.cn/download?appid=1407&amp;fileid=file-id&amp;rkey=key,file_size=123]',
    });

    expect(message?.segments).toEqual([
      {
        type: 'image',
        data: {
          file: 'abc.jpg',
          url: 'https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=file-id&rkey=key',
          file_size: '123',
        },
      },
    ]);
    expect(message?.text).toBe(
      '[image file="abc.jpg" url="https://multimedia.nt.qq.com.cn/download?appid=1407&fileid=file-id&rkey=key"]',
    );
  });
});
