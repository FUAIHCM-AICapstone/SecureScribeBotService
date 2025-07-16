export const getRecordingNamePrefix = (provider: 'google') => {
  switch(provider) {
    case 'google':
      return 'Google Meet Recording';
    default:
      return 'Recording';
  }
};
