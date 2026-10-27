import { createHmac } from 'node:crypto';
import { type Result, ok } from '@wave/contracts';
import type {
  AcrCloudScannerPort,
  AcrCloudScanResult,
} from '../ports/acrcloud-scanner.port.js';

export class ConfigurableAcrCloudAdapter implements AcrCloudScannerPort {
  private readonly accessKey: string;
  private readonly accessSecret: string;

  public constructor(accessKey = 'acr_sandbox_key', accessSecret = 'acr_sandbox_secret') {
    this.accessKey = accessKey;
    this.accessSecret = accessSecret;
  }

  public async identifyAudioSnippet(params: {
    wavBuffer: Buffer;
    simulatedScore?: number;
    simulatedMatchedTitle?: string;
    simulatedMatchedArtist?: string;
  }): Promise<Result<AcrCloudScanResult>> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const stringToSign = [
      'POST',
      '/v1/identify',
      this.accessKey,
      'audio',
      '1',
      timestamp,
    ].join('\n');

    const signatureBase64Used = createHmac('sha1', this.accessSecret)
      .update(Buffer.from(stringToSign, 'utf8'))
      .digest('base64');

    const scorePercent = params.simulatedScore ?? 12; // Default clean pass (code 1001 / <45%)

    return ok({
      scorePercent,
      matchedTitle:
        params.simulatedMatchedTitle ??
        (scorePercent >= 45 ? 'Cash In Cash Out (Type Beat Instrumental)' : null),
      matchedArtist:
        params.simulatedMatchedArtist ??
        (scorePercent >= 45 ? 'BeatStars Producer Publishing' : null),
      signatureBase64Used,
    });
  }
}
