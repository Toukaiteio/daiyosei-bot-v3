import { nanoid } from 'nanoid';
import type WebSocket from 'ws';

export type OneBotAction = {
  action: string;
  params?: Record<string, unknown>;
};

export class OneBotConnection {
  readonly id = nanoid();

  constructor(private readonly socket: WebSocket) {}

  sendAction(action: OneBotAction) {
    if (this.socket.readyState !== this.socket.OPEN) {
      throw new Error('OneBot connection is not open');
    }

    const echo = nanoid();
    this.socket.send(
      JSON.stringify({
        action: action.action,
        params: action.params ?? {},
        echo,
      }),
    );
    return echo;
  }
}
