import { NativeModule, requireNativeModule } from 'expo';

declare class PresageModule extends NativeModule<{}> {}

export default requireNativeModule<PresageModule>('Presage');
