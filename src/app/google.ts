import { AxiosError } from 'axios';
import { GoogleMeetBot } from '../bots/GoogleMeetBot';
import express, { Request, Response } from 'express';
import { createCorrelationId, loggerFactory } from '../util/logger';
import { MeetingJoinParams } from './common';
import { globalJobStore } from '../lib/globalJobStore';

const router = express.Router();

const joinGoogleMeet = async (req: Request, res: Response) => {
  const {
    bearerToken,
    url,
    name,
    teamId,
    timezone,
    userId,
    eventId,
    botId
  }: MeetingJoinParams = req.body;

  // Validate required fields
  if (!bearerToken || !url || !name || !teamId || !timezone || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: bearerToken, url, name, teamId, timezone, userId'
    });
  }

  if (!botId && !eventId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: botId or eventId'
    });
  }

  // Create correlation ID and logger
  const correlationId = createCorrelationId({ teamId, userId, botId, eventId, url });
  const logger = loggerFactory(correlationId, 'google');

  try {

    const jobResult = await globalJobStore.addJob(async () => {
      const bot = new GoogleMeetBot(logger);
      await bot.join({ url, name, bearerToken, teamId, timezone, userId, eventId, botId });

      logger.info('Joined Google Meet event successfully.', userId, teamId);
    }, logger);

    if (!jobResult.accepted) {
      return res.status(409).json({
        success: false,
        error: 'Another meeting is currently being processed. Please try again later.',
        data: { userId, teamId, eventId, botId }
      });
    }

    // Job was accepted, return immediate response
    logger.info('Google Meet job accepted and started processing', { userId, teamId });

    return res.status(202).json({
      success: true,
      message: 'Google Meet join request accepted and processing started',
      data: {
        userId,
        teamId,
        eventId,
        botId,
        status: 'processing'
      }
    });

  } catch (error) {
    logger.error('Error setting up Google Meet job:', { userId, teamId, botId, eventId, error });

    if (error instanceof AxiosError) {
      logger.error('axios error', {
        userId,
        teamId,
        botId,
        data: error?.response?.data,
        config: error?.response?.config
      });
    }

    // Return appropriate error response
    const statusCode = error instanceof AxiosError ? (error.response?.status || 500) : 500;

    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      data: { userId, teamId, eventId, botId }
    });
  }
};

router.post('/join', joinGoogleMeet);

export default router;
