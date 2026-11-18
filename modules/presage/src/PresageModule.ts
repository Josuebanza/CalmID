import {
  NativeModule,
  requireNativeModule,
} from "expo";

import {
  requireNativeViewManager,
} from "expo-modules-core";

import type {
  ComponentType,
} from "react";

import type {
  ViewProps,
} from "react-native";

export type PresagePreviewDiagnostics = {
  attached: boolean;
  width: number;
  height: number;
  previewWidth: number;
  previewHeight: number;
  streamState: string;
  sdkStatus: string;
};

export type PresageVitals = {
  pulse: number | null;
  breathingRate: number | null;

  validationCode: string | null;
  validationHint: string | null;

  error: string | null;
};

declare class PresageModule
  extends NativeModule<{}> {

  configure(
    apiKey: string
  ): boolean;

  start(): Promise<boolean>;

  stop(): Promise<boolean>;

  getStatus(): string;

  getPreviewDiagnostics(): PresagePreviewDiagnostics;

  getVitals(): PresageVitals;
}

const Presage =
  requireNativeModule<PresageModule>(
    "Presage"
  );

export const PresageCameraView =
  requireNativeViewManager<ViewProps>(
    "Presage"
  ) as ComponentType<ViewProps>;

export default Presage;