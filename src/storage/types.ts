export type StoredChatMessage = {
  messageId?: string;
  selfId?: string;
  userId?: string;
  groupId?: string;
  type: 'private' | 'group';
  role?: 'user' | 'assistant';
  text: string;
  raw: unknown;
  createdAt: Date;
};

export type ContextMessage = {
  role: 'user' | 'assistant';
  userId?: string;
  text: string;
  createdAt: string;
};

export type StoredImage = {
  imageHash: string;
  messageId?: string;
  userId?: string;
  groupId?: string;
  url?: string;
  localPath?: string;
  fileId?: string;
  summary?: string;
  ocrText?: string;
  tags?: string[];
  raw: unknown;
  createdAt: Date;
};

export type RecentImageQuery = {
  userId?: string;
  groupId?: string;
  since?: Date;
  limit?: number;
};

export type RecentImage = {
  id: number;
  imageHash: string;
  messageId?: string;
  userId?: string;
  groupId?: string;
  url?: string;
  localPath?: string;
  fileId?: string;
  summary?: string;
  ocrText?: string;
  tags: string[];
  createdAt: string;
};
