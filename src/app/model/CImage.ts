import {Layer} from './layer';
import {ICImage} from './ICImage';

export class CImage implements ICImage {
  public id: string;
  public name: string;
  data: string;
  layers: Layer[] = [];
  public type = 'img';

  public getData(): string {
    return this.data;
  }

  public getLayers(): Layer[] {
    return this.layers;
  }

  public setLayers(layers: Layer[]) {
    this.layers = layers;
  }
}