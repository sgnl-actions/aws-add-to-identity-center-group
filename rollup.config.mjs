import { createConfig } from '@sgnl-actions/rollup-config';
import json from '@rollup/plugin-json';

export default createConfig({
  inlineDynamicImports: true,
  plugins: [json()]
});
