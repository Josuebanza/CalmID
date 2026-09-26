import { registerWebModule, NativeModule } from 'expo';

class PresageModule extends NativeModule<{}> {}

export default registerWebModule(PresageModule, 'PresageModule');
