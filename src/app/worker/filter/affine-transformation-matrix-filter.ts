import {AbstractFilter, Services} from "./abstract-filter";
import {FilterData} from "../filter-data";
import {FilterHelper} from "./filter-helper";
import {fromObject, fromTriangles} from "transformation-matrix";
import {map} from "rxjs/operators";

export class AffineTransformationMatrixFilter extends AbstractFilter {

  constructor(services: Services) {
    super(services);
  }

  doFilter(sourcePos: number, sourceLayerID: string, targetPos: number = sourcePos, targetLayerID: string = sourceLayerID, targetDataName = 'affineMatrix') {
    return map((data: FilterData) => {

      const source = this.getImage(sourcePos, data);
      const target = this.getImage(targetPos, data);

      if (!source || !target) {
        throw new Error(`Images not found, images loaded: ${data.imgStack.length}, first image position ${sourcePos}, second image position ${targetPos}. <br> Image position has to 0 <= position < ${data.imgStack.length}`);
      }

      const sourceLayer = FilterHelper.findLayer(source.layers, sourceLayerID);
      const targetLayer = FilterHelper.findLayer(target.layers, targetLayerID);

      if (sourceLayer === null || targetLayer === null) {
        throw new Error(`Layers not found on IMG 1 ${sourceLayerID} or IMG 2 ${targetLayerID};`);
      }

      if (sourceLayer.lines[0].length < 3  || sourceLayer.lines[0].length !== targetLayer.lines[0].length) {
        throw new Error(`The amount of points in source and target layer must match and must be > 3`);
      }

      const sourceLayerPoints = sourceLayer.lines[0].map(x => {
        return {x: x.x, y: x.y}
      });

      const targetLayerPoints = targetLayer.lines[0].map(x => {
        return {x: x.x, y: x.y}
      });

      const resultArrys = [];

      for (let i = 0; i < sourceLayerPoints.length - 2; i++) {
        resultArrys.push(fromTriangles(sourceLayerPoints.slice(i, i + 3), targetLayerPoints.slice(i, i + 3)));
      }

      const t = { a : 0,b :0,c:0,d:0,e:0,f:0};
      resultArrys.forEach( x =>{
        t.a += x.a;
        t.b += x.b;
        t.c += x.c;
        t.d += x.d;
        t.e += x.e;
        t.f += x.f;
      });

      t.a = t.a / resultArrys.length;
      t.b = t.b / resultArrys.length;
      t.c = t.c / resultArrys.length;
      t.d = t.d / resultArrys.length;
      t.e = t.e / resultArrys.length;
      t.f = t.f / resultArrys.length;

      data.setData(targetDataName, fromObject(t));

      return data;
    });
  }
}
