import {Injectable} from '@angular/core';
import {CImage} from "../model/CImage";
import CImageUtil from "../utils/cimage-util";
import {ImageService} from "./image.service";
import {forkJoin, Observable} from 'rxjs';
import {flatMap} from "rxjs/operators";
import {AuthenticationService} from "./authentication.service";
import {Point} from "../model/point";

@Injectable({
  providedIn: 'root'
})
export class ScImportService {

  constructor(public imageService: ImageService,
              private authenticationService: AuthenticationService) {
  }


  public processData(mapping: { maxX: number, maxY: number, checkImage: boolean, maps: [{ name: string, path: string, prefix?: string, suffix?: string }] }, idata: [{ id: number, x: number, y: number, tag: string, name: string, idimage: string, idanalysis: string }]): Observable<any> {

    const simpleObservable = new Observable((observer) => {
      let arr: { [key: string]: CImage } = {};
      let missingMappings = new Set();

      const colors = ['#FFFFFF', '#2919ff', '#FF33FF', '#FFFF99', '#00B3E6',
          '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
          '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A',
          '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
          '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC',
          '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
          '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680',
          '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
          '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3',
          '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'];

        for (let col of idata) {
          // foldername-imageid
          let img = arr[col.name];

          if (img == undefined) {

            // const imgName = col.name.split("-");
            const map = mapping.maps.find((x) => col.name.match(x.name));

            if (map == undefined) {
              missingMappings.add(col.name);
              continue;
            }

            img = new CImage();
            img.name = (map.prefix || "") + col.name;
            img.id = btoa(map.path + img.name + (map.suffix || ""));
            arr[col.name] = img;
          }

          const layer = CImageUtil.findOrAddLayer(img, col.tag + 1, this.authenticationService.currentUserSettingsValue.defaultLayerSettings);
          layer.color = colors[col.tag];
          const lastLIne = CImageUtil.initLastLineOfLayer(layer);

          if (col.x >= 0 && col.x <= mapping.maxX && col.y >= 0 && col.y <= mapping.maxY)
            CImageUtil.addPointToLine(layer,lastLIne, new Point(col.x, col.y));
          else
            console.log(`Fehler Punkt ${col.x}/${col.y} nicht in bounds (${mapping.maxX}/${mapping.maxY})`)
        }

        for (let map of missingMappings) {
          console.log(`Mapping for ${map} is missing`);
        }

        console.log("-----")


        observer.next(arr);
        observer.complete()
      }
    );

    return simpleObservable.pipe(flatMap(arr => {
      console.log("--Join---")
      let result = [];
      for (let imgToSave of Object.keys(arr)) {
        console.log("adding" + arr[imgToSave].name)
        result.push(this.imageService.updateExistingImage(arr[imgToSave]));
      }
      console.log(arr);
      return forkJoin(result);
    }))
  }
}
