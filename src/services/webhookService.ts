import axios from 'axios';
import { Logger } from 'winston';
import FormData from 'form-data';

export interface WebhookPayload {
  status: 'pending' | 'waiting_for_host' | 'joined' | 'recording' | 'complete' | 'error';
  userId: string;
  teamId: string;
  botId?: string;
  eventId?: string;
  meetingUrl: string;
  timestamp: string;
  error?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  fileData?: Buffer;
  fileName?: string;
}

export interface StatusUpdatePayload {
  botId: string;
  status: 'pending' | 'waiting_for_host' | 'joined' | 'recording' | 'complete' | 'error';
  meetingUrl: string;
  timestamp: string;
  error?: string;
  actual_start_time?: string;
  actual_end_time?: string;
}

export const callStatusWebhook = async (
  webhookUrl: string,
  bearerToken: string,
  payload: StatusUpdatePayload,
  logger: Logger
): Promise<boolean> => {
  logger.info('WEBHOOK: Sending status update', {
    webhookUrl,
    status: payload.status,
    botId: payload.botId,
    meetingUrl: payload.meetingUrl,
    timestamp: payload.timestamp,
    error: payload.error,
  });

  try {
    const formData = new FormData();
    formData.append('botId', payload.botId);
    formData.append('status', payload.status);
    formData.append('meetingUrl', payload.meetingUrl);
    formData.append('timestamp', payload.timestamp);

    if (payload.error) formData.append('error', payload.error);
    if (payload.actual_start_time) formData.append('actual_start_time', payload.actual_start_time);
    if (payload.actual_end_time) formData.append('actual_end_time', payload.actual_end_time);

    const response = await axios.post(webhookUrl, formData, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        ...formData.getHeaders()
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    logger.info('WEBHOOK: Status update successful', {
      status: response.status,
      statusText: response.statusText
    });

    return response.status >= 200 && response.status < 300;
  } catch (error) {
    logger.error('WEBHOOK: Status update failed', {
      error: error.message,
      code: error.code,
      botId: payload.botId,
    });
    return false;
  }
};

export const callWebhook = async (
  webhookUrl: string,
  bearerToken: string,
  payload: WebhookPayload,
  logger: Logger
): Promise<boolean> => {
  logger.info('WEBHOOK: Starting webhook call', {
    webhookUrl,
    status: payload.status,
    userId: payload.userId,
    teamId: payload.teamId,
    botId: payload.botId,
    eventId: payload.eventId,
    meetingUrl: payload.meetingUrl,
    timestamp: payload.timestamp,
    error: payload.error,
    hasFileData: !!payload.fileData,
    fileName: payload.fileName
  });

  try {
    // Create FormData for multipart upload
    const formData = new FormData();

    // Add all payload fields except fileData
    formData.append('status', payload.status);
    formData.append('userId', payload.userId);
    formData.append('teamId', payload.teamId);
    formData.append('meetingUrl', payload.meetingUrl);
    formData.append('timestamp', payload.timestamp);

    if (payload.botId) formData.append('botId', payload.botId);
    if (payload.eventId) formData.append('eventId', payload.eventId);
    if (payload.error) formData.append('error', payload.error);

    // Add file if present
    if (payload.fileData && payload.fileName) {
      formData.append('recording', payload.fileData, {
        filename: payload.fileName,
        contentType: 'video/webm'
      });
      logger.info('WEBHOOK: Added file attachment to form data', {
        fileName: payload.fileName,
        fileSize: payload.fileData.length
      });
    }

    logger.info('WEBHOOK: Preparing axios request with FormData', {
      method: 'POST',
      url: webhookUrl,
      contentType: `multipart/form-data; boundary=${formData.getBoundary()}`
    });

    const response = await axios.post(webhookUrl, formData, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        ...formData.getHeaders()
      },
      timeout: 30000, // 30 seconds timeout
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    logger.info('WEBHOOK: Success response received', {
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      headers: response.headers
    });

    if (response.status >= 200 && response.status < 300) {
      logger.info('WEBHOOK: Call completed successfully', {
        status: response.status,
        success: true
      });
      return true;
    } else {
      logger.error('WEBHOOK: Unexpected status code', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      return false;
    }
  } catch (error) {
    logger.error('WEBHOOK: Call failed with error', {
      error: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
      webhookUrl,
      payload
    });

    if (error.code === 'ECONNREFUSED') {
      logger.error('WEBHOOK: Connection refused', { webhookUrl });
    } else if (error.code === 'ENOTFOUND') {
      logger.error('WEBHOOK: Host not found', { webhookUrl });
    } else if (error.code === 'ETIMEDOUT') {
      logger.error('WEBHOOK: Request timeout', { webhookUrl });
    }

    return false;
  }
};
