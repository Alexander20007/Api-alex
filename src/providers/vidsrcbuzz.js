import { VidSrcProvider } from './vidsrc.js';

/**
 * VidSrcBuzzProvider — clona VidSrcProvider trocando apenas o domínio.
 * O software do vidsrc.buzz é idêntico ao do vidsrc.in.
 */
export class VidSrcBuzzProvider extends VidSrcProvider {
  constructor() {
    super();
    this.config = {
      ...this.config,
      name: 'vidsrcbuzz',
      domain: 'vidsrc.buzz',
    };
  }
}
