
export interface BotLaunchParams {
  provider: 'google';
  url: string;
  name: string;
  teamId: string;
  userId: string;
  bearerToken: string;
  timezone: string;
  botId?: string;
  eventId?: string;
}

export interface JoinParams {
  url: string;
  name: string;
  bearerToken: string;
  teamId: string;
  timezone: string;
  userId: string;
  botId?: string;
  eventId?: string;
}

export abstract class AbstractMeetBot {
  abstract join(params: JoinParams): Promise<void>;
}
