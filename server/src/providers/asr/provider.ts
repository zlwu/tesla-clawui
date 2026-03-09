export type AsrTranscribeInput = {
  filePath: string;
  mimeType: string;
  language: string;
  sizeBytes: number;
};

export type AsrTranscribeResult = {
  transcript: string;
};

export type AsrProvider = {
  transcribe(input: AsrTranscribeInput): Promise<AsrTranscribeResult>;
};
