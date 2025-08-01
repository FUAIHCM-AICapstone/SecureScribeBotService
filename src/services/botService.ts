import { createApiV2 } from '../util/auth';
import { BotStatus, IVFSResponse, WaitingAtLobbyCategory } from '../types';
import config from '../config';
import { Logger } from 'winston';

export const patchBotStatus = async ({
  eventId,
  botId,
  provider,
  status,
  token,
}: {
    eventId?: string,
    token: string,
    botId?: string,
    provider: 'google',
    status: BotStatus[],
}, logger: Logger) => {
  try {
    if (!config.serviceKey) {
      logger.error('ScreenApp service key is not set');
      return false;
    }
    const apiV2 = createApiV2(token, config.serviceKey);
    const response = await apiV2.patch<
        IVFSResponse<never>
    >('/meeting/app/bot/status', {
      eventId,
      botId,
      provider,
      status,
    });
    return response.data.success;
  } catch(e) {
    logger.error('Can\'t update the bot status', e.message, e?.response?.data);
    return false;
  }
};

export const addBotLog = async ({
  eventId,
  botId,
  provider,
  level,
  message,
  category,
  subCategory,
  token,
}: {
    eventId?: string,
    token: string,
    botId?: string,
    provider: 'google',
    level: 'info' | 'error',
    message: string,
    category: WaitingAtLobbyCategory['category'],
    subCategory: WaitingAtLobbyCategory['subCategory'],
}, logger: Logger) => {
  try {
    if (!config.serviceKey) {
      logger.error('ScreenApp service key is not set');
      return false;
    }
    const apiV2 = createApiV2(token, config.serviceKey);
    const response = await apiV2.patch<
        IVFSResponse<never>
    >('/meeting/app/bot/log', {
      eventId,
      botId,
      provider,
      level,
      message,
      category,
      subCategory,
    });
    return response.data.success;
  } catch(e) {
    logger.error('Can\'t add the bot log', e.message, e?.response?.data);
    return false;
  }
};
