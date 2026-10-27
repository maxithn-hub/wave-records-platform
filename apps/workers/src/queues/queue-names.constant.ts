export const WAVE_BULLMQ_QUEUES = {
  AUDIO_FORENSICS_FFMPEG: 'wave:queue:audio-forensics-ffmpeg',
  ARTWORK_VALIDATOR_SHARP: 'wave:queue:artwork-validator-sharp',
  COPYRIGHT_ACRCLOUD: 'wave:queue:copyright-acrcloud',
  REVELATOR_DISPATCHER: 'wave:queue:revelator-dispatcher',
  DEAD_LETTER_ISOLATION: 'wave:queue:dead-letter-isolation',
} as const;

export type WaveQueueName =
  (typeof WAVE_BULLMQ_QUEUES)[keyof typeof WAVE_BULLMQ_QUEUES];
