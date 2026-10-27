import type { Result } from '@wave/contracts';

export interface AcrCloudScanResult {
  readonly scorePercent: number;
  readonly matchedTitle: string | null;
  readonly matchedArtist: string | null;
  readonly signatureBase64Used: string;
}

export interface AcrCloudScannerPort {
  identifyAudioSnippet(params: {
    wavBuffer: Buffer;
    simulatedScore?: number;
    simulatedMatchedTitle?: string;
    simulatedMatchedArtist?: string;
  }): Promise<Result<AcrCloudScanResult>>;
}
