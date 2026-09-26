import { NativeModule, requireNativeModule } from 'expo';

export type PresageVitals = {
  pulse: number | null;
  breathingRate: number | null;
};

declare class PresageModule extends NativeModule<{}> {
  configure(apiKey: string): boolean;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  getStatus(): string;
  getVitals(): PresageVitals;
}

export default requireNativeModule<PresageModule>('Presage');