import {PNG} from "pngjs";
import {AbstractFilter, Services} from "./abstract-filter";
import {FilterHelper} from "./filter-helper";
import {FilterData} from "../filter-data";
import {ContrastOptions} from "../filter-core";
import {map} from "rxjs/operators";

export class ContrastFilter extends AbstractFilter {

  constructor(services: Services) {
    super(services);
  }

  doFilter(sourcePos: number, contrastOptions: ContrastOptions) {
    return map((data: FilterData) => {

      const source = this.getImage(sourcePos, data);
      const target = this.getImage(contrastOptions.targetPos, data);

      if (!source || !target) {
        throw new Error("Source or target not found!")
      }

      const sourceImage = FilterHelper.imageToPNG(source);
      const targetImage = new PNG({width: sourceImage.width, height: sourceImage.height});

      let i = 0;
      for (let y = 0; y < sourceImage.height; y++) {
        for (let x = 0; x < sourceImage.width; x++) {
          const r = sourceImage.data[i] * contrastOptions.contrast;
          const g = sourceImage.data[i + 1] * contrastOptions.contrast;
          const b = sourceImage.data[i + 2] * contrastOptions.contrast;

          targetImage.data[i] = r > 255 ? 255 : r;
          targetImage.data[i + 1] = g > 255 ? 255 : g;
          targetImage.data[i + 2] = b > 255 ? 255 : b;
          targetImage.data[i + 3] = sourceImage.data[i + 3];
          i += 4;
        }
      }

      FilterHelper.pngToImage(targetImage, target);
      return data;
    });
  }
}
