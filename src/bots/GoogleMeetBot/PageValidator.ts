/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from 'winston';
import { IGoogleMeetPageValidator } from '../../types';

export class GoogleMeetPageValidator implements IGoogleMeetPageValidator {
  private context: any;
  private logger: Logger;

  constructor(context: any, logger: Logger) {
    this.logger.info('PAGE_VALIDATOR: PageValidator initialized');
    this.context = context;
    this.logger = logger;
  }

  async verifyGoogleMeetPage(): Promise<'SIGN_IN_PAGE' | 'GOOGLE_MEET_PAGE' | 'UNSUPPORTED_PAGE' | null> {
    try {
      this.logger.info('PAGE_VALIDATOR: Verifying Google Meet page', { userId: this.context.userId, teamId: this.context.teamId });

      const detectSignInPage = async () => {
        let result = false;
        try {
          const url = await this.context.page.url();
          this.logger.info('Current page URL:', { url });

          if (url.startsWith('https://accounts.google.com/')) {
            this.logger.info('Detected Google accounts URL, checking for sign-in page...', { userId: this.context.userId, teamId: this.context.teamId });
            result = true;
          }

          const signInPage = await this.context.page.locator('h1', { hasText: 'Sign in' });
          const signInCount = await signInPage.count();
          if (signInCount > 0 && await signInPage.isVisible()) {
            this.logger.info('Found "Sign in" heading on page', { userId: this.context.userId, teamId: this.context.teamId });
            result = result && true;
          }
        } catch (err) {
          this.logger.error('Error in detectSignInPage:', {
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined
          });
        }
        return result;
      };

      const pageUrl = await this.context.page.url();
      this.logger.info('Checking page URL pattern...', { pageUrl });

      if (!pageUrl.includes('meet.google.com')) {
        this.logger.info('Page URL does not contain meet.google.com, checking for sign-in page...');
        const signInPage = await detectSignInPage();
        const result = signInPage ? 'SIGN_IN_PAGE' : 'UNSUPPORTED_PAGE';
        this.logger.info('Page verification result:', { result, signInPage });
        return result;
      }

      this.logger.info('Page URL contains meet.google.com, assuming Google Meet page');
      return 'GOOGLE_MEET_PAGE';
    } catch (e) {
      this.logger.error('Error verifying if Google Meet bot is on the Google Meet page:', {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
        userId: this.context.userId,
        teamId: this.context.teamId
      });
      return null;
    }
  }
}
