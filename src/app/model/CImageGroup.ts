import {CImage} from './CImage';
import {ICImage} from './ICImage';
import {Layer} from "./layer";
import CImageUtil from "../utils/cimage-util";

export class CImageGroup implements ICImage {
  public id: string;
  public name: string;
  public images: CImage[];
  public type = 'group';
  hasLayerData = false;

  public activeImage = 0;
  concurrencyCounter: number;

  public getData(): string {
    if (this.activeImage >= 0 && this.activeImage < this.images.length) {
      return this.images[this.activeImage].data;
    } else {
      return '';
    }
  }

  public getLayers(): Layer[] {
    if (this.activeImage >= 0 && this.activeImage < this.images.length) {
      return this.images[this.activeImage].layers;
    } else {
      return [];
    }
  }

  public setLayers(layers: Layer[]) {
    if (this.activeImage >= 0 && this.activeImage < this.images.length) {
      this.images[this.activeImage].layers = layers;
    }
  }

  public getHeight() {
    if (this.activeImage >= 0 && this.activeImage < this.images.length) {
      return this.images[this.activeImage].height;
    } else {
      return 0;
    }
  }

  public getWidth() {
    if (this.activeImage >= 0 && this.activeImage < this.images.length) {
      return this.images[this.activeImage].width;
    } else {
      return 0;
    }
  }

  public getFileExtension() {
    if (this.activeImage >= 0 && this.activeImage < this.images.length) {
      return this.images[this.activeImage].fileExtension;
    } else {
      return 0;
    }
  }

  public hasData() {
    return this.getData() !== ''
  }

  public getImage() {
    if (this.activeImage >= 0 && this.activeImage < this.images.length) {
      return this.images[this.activeImage];
    } else {
      return  CImageUtil.prepareImage(new CImage());
    }
  }
}
