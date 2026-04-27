export type OneBotMessageSegment = {
  type: string;
  data: Record<string, unknown>;
};

export type OneBotInboundEvent = {
  time?: number;
  self_id?: number | string;
  post_type: string;
  message_type?: 'private' | 'group';
  sub_type?: string;
  user_id?: number | string;
  group_id?: number | string;
  message_id?: number | string;
  message?: string | OneBotMessageSegment[];
  raw_message?: string;
};

export type BotMessage = {
  id?: string;
  type: 'private' | 'group';
  selfId?: string;
  userId?: string;
  groupId?: string;
  text: string;
  segments: OneBotMessageSegment[];
  raw: OneBotInboundEvent;
};
