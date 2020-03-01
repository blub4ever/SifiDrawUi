import {Injectable} from '@angular/core';
import {ImageMagicFilter} from '../filter/image-magic-filter';
import {ImageFilter} from '../filter/image-filter';
import {ImageMagicService} from './image-magic.service';
import {CImage} from '../model/CImage';
import {ImageEventFilter} from '../filter/image-event-filter';
import {ImageService} from './image.service';
import {Dataset} from '../model/dataset';
import {forkJoin, from, Observable, OperatorFunction} from 'rxjs';
import {concatMap, flatMap, map, mergeMap} from 'rxjs/operators';
import {FilterData} from '../worker/filter-data';
import {ColorType, PNG} from 'pngjs';
import DrawUtil from '../utils/draw-util';
import {Layer} from '../model/layer';
import {Point} from '../model/point';
import {CPolygon} from '../utils/cpolygon';
import {SplineUtil} from '../utils/spline-util';
import {DistancePointContainer, PointLineUtil} from '../utils/point-line-util';
import {ImageJService} from './image-j.service';
import {FlaskService} from './flask.service';
import CImageUtil from '../utils/cimage-util';
import {DatasetService} from './dataset.service';
import {isNumber} from 'util';
import {ProcessCallback} from '../worker/processCallback';
import {DisplayCallback} from '../worker/display-callback';
import {Equation, parse} from 'algebra.js';
import VectorUtils from '../utils/vector-utils';
import {HostEpithelial} from '../utils/vaa/host-epithelial';
import {SimpleLine} from '../utils/vaa/model/simple-line';
import {Vector} from '../utils/vaa/model/vector';
import {ComplexLine} from '../utils/vaa/model/complex-line';
import {HostParabola} from '../utils/vaa/host-parabola';
import {LineJoiner} from '../utils/vaa/line-joiner';
import {GraftFinder} from '../utils/vaa/graft-finder';
import {ICImage} from '../model/ICImage';
import {CImageGroup} from '../model/CImageGroup';
import {ImageGroupService} from './image-group.service';

@Injectable({
  providedIn: 'root'
})
export class FilterService {

  constructor(private imageMagicService: ImageMagicService,
              private datasetService: DatasetService,
              private imageService: ImageService,
              private imageGroupService: ImageGroupService,
              private imageJService: ImageJService,
              private flaskService: FlaskService) {
  }

  private loadICImage(img: ICImage): Observable<ICImage> {
    if (img instanceof CImageGroup) {
      return this.imageService.getImage(img.id);
    } else {
      return this.imageGroupService.getImageGroup(img.id);
    }
  }

  public getNewMagicFilter(command: string, parentFilter?: ImageFilter) {
    const m = new ImageMagicFilter(parentFilter || undefined, command);
    m.imageMagicService = this.imageMagicService;
    return m;
  }

  public getNewEventFilter(callBack: (image: CImage) => any, bind: any, origImage: CImage, parentFilter: ImageFilter) {
    return new ImageEventFilter(parentFilter || undefined, callBack.bind(bind), origImage);
  }

  public runFilterOnDatasetID(datasets: string[], func: string, env: { processCallback?: ProcessCallback, displayCallback?: DisplayCallback }) {

    const tFrom = from;
    const tConcatMap = concatMap;
    const tMergeMap = mergeMap;
    const obs = Observable;
    const im = CImage;
    const m = this;
    const display = env.displayCallback;
    const process = env.processCallback;


    const exe = 'tFrom(datasets).pipe(tConcatMap(' +
      'x => this.datasetService.getDataset(x).pipe(' +
      'tMergeMap(dataset =>' +
      'tFrom(dataset.images).pipe(' +
      'tMergeMap(image =>' +
      'new obs((observer) => { observer.next(image); observer.complete()}).pipe(' +
      func +
      ')' +
      ',10)' +
      ')' +
      ')' +
      ')' +
      ')).subscribe(x => console.log(\'test\'));';

    eval(exe);
    // tFrom(datasets).pipe(tConcatMap(
    //   x => this.datasetService.getDataset(x).pipe(
    //     tMergeMap(dataset =>
    //       tFrom(dataset.images).pipe(
    //         tMergeMap(image =>
    //           new Observable<CImage>((observer) => { observer.next(image); observer.complete()}).pipe(
    //             m.load(),
    //             m.save('tmp', [{dataset : '*', mapping : 'ttt'}], false, false, '')
    //           )
    //         ,10)
    //       )
    //     )
    //   )
    // )).subscribe(x => console.log('test'));

    // console.log(exe);
  }

  public runFilterOnDataset(dataset: Dataset, func: string, env: { processCallback?: ProcessCallback, displayCallback?: DisplayCallback }) {

    const display = env.displayCallback;
    const process = env.processCallback;

    const splittedString = func.split('\n');
    const ops = [];

    try {
      for (const c of splittedString) {
        if (c !== '') {
          console.log('this.' + c);
          ops.push(eval('this.' + c));
        } else {
          console.log('skip');
        }
      }

      const result = ops.reduce((ob: Observable<{}>, op: OperatorFunction<{}, {}>) => ob.pipe(op), from(dataset.images));
      result.subscribe(value => {
        process.callback();
        console.log('Ende');
      });
    } catch (e) {

    }
  }

  public runWorkers(datasets: Dataset[], filterChain: string, env: { processCallback?: ProcessCallback, displayCallback?: DisplayCallback }) {
    try {

      const f = this;
      const display = env.displayCallback;
      const results = [];

      let count = 0;

      for (let y = 0; y < datasets.length; y++) {
        for (let i = 0; i < datasets[y].images.length; i++) {
          const data = new FilterData();
          // TODO cast!
          data.pushIMG(datasets[y].images[i] as CImage);
          data.origName = atob(datasets[y].images[i].id);

          data.numberInBatch = count;

          let start;

          eval(filterChain);

          if (start == undefined) {
            console.log('Fehler start nicht defined');
            return;
          }

          start.pushCallBack(env.processCallback);
          results.push(start.doWork(undefined, data));
          count++;
        }
      }

      if (env.processCallback) {
        env.processCallback.maxRunCount = results.length * 2;
        env.processCallback.completedRunCount = 0;
        env.processCallback.percentRun = 0;
      }

      forkJoin(results).subscribe(x => {
        if (env.processCallback) {
          env.processCallback.exportIsRunning = false;
        }
        console.log('Ende');
      });

    } catch (e) {
      if (e instanceof SyntaxError) {
        alert(e);
      }
      console.error(e);
      if (env.processCallback) {
        env.processCallback.exportIsRunning = false;
      }
    }
  }

  public load() {
    return flatMap((data: ICImage) => this.loadICImage(data).pipe(map(cimg => {
      console.log(`Load img ${atob(cimg.id)}`);
      const filterData = new FilterData();
      filterData.pushICIMG(cimg);
      filterData.origName = atob(cimg.id);
      return filterData;
    })));
  }

  public cloneImage({index = null, displayCallback = null}: { index?: number, displayCallback?: DisplayCallback } = {}) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      console.log(`Cloning IMG Index ${index} to ${data.imgStack.length}`);

      if (index && index < 0 && index >= data.imgStack.length) {
        observer.error(`Clone Image out of bounds ${index}`);
      }

      const imToCopy = index ? data.imgStack[index] : data.img;
      const copy = Object.assign(new CImage(), imToCopy);
      copy.layers = imToCopy.layers;
      data.pushIMG(copy);

      if (displayCallback !== null) {
        displayCallback.addImage(copy);
      }

      observer.next(data);
      observer.complete();
    }));
  }

  public activeImage(index: number) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      console.log(`Setting IMG Index ${index} as active`);

      if (index && index < 0 && index >= data.imgStack.length) {
        observer.error(`Clone Image out of bounds ${index}`);
      }

      data.img = data.imgStack[index];

      observer.next(data);
      observer.complete();
    }));
  }

  public flask(endpoint: string) {
    return flatMap((data: FilterData) => this.flaskService.processImage(data.img, endpoint).pipe(map(cimg => {
      console.log('Fask img' + atob(cimg.id));

      data.img.data = cimg.data;

      return data;
    })));
  }

  public findCenterLines({targetName = 'lines'}: { targetName?: string } = {}) {
    return flatMap((data: FilterData) =>
      this.imageJService.getLines(data.img).pipe(
        map(json => {
          console.log(`Searching for Lines ..`);
          const map = new Map<string, SimpleLine>();

          for (const res of json) {
            let contour = map.get(res['Contour ID']);
            // @ts-ignore
            const point = new Vector(Math.round(res.X), Math.round(res.Y), res['Pos.']);

            if (!contour) {
              // @ts-ignore
              contour = map.set(res['Contour ID'], new SimpleLine(res['Contour ID'], res.Length)).get(res['Contour ID']);
            }

            contour.addPoint(point);
          }
          const dis = new ComplexLine();
          dis.addLines(Array.from(map.values()));


          for (const line of dis.lines) {
            if (line.getFirstPoint().x > line.getLastPoint().x) {
              line.reverse();
            }
          }


          dis.lines.sort((n1, n2) => {
            if (n1.getFirstPoint().x > n2.getFirstPoint().x) {
              return 1;
            } else if (n1.getFirstPoint().x < n2.getFirstPoint().x) {
              return -1;
            } else {
              return 0;
            }
            });

          data.setData(targetName, dis);
          return data;
          }
        )
      )
    );
  }

  public sortLines(sourceName: string = 'lines', targetName: string = 'sortedLines') {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      const lines = data.getData(sourceName);

      console.log(sourceName);
      console.log(lines);

      if (lines instanceof DistancePointContainer) {
        if (lines.getLines().length > 1) {
          console.log('Sort lines');
          data.setData(targetName, PointLineUtil.orderLines(lines.getLines()));
        } else {
          console.log('No or only one line found, not sorting');
          data.setData(targetName, lines);
        }

      } else {
        observer.error(`Could not find source ${sourceName}`);
      }

      observer.next(data);
      observer.complete();
    }));
  }

  public prepareHost(joinLinesMaxTo: number = 100, sourceName: string = 'sortedLines', targetName: string = 'hostLines') {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      const sortedLines = data.getData(sourceName);

      if (sortedLines instanceof DistancePointContainer && sortedLines.hasLines()) {
        console.log('Preparing Host');

        const container: DistancePointContainer[] = [];
        container.push(new DistancePointContainer(sortedLines.getLine(0)));
        let index = 0;

        for (let i = 1; i < sortedLines.getLines().length; i++) {
          const line = sortedLines.getLine(i);

          console.log(`Length of index ${i - 1} to next ${sortedLines.getDistanceToNextLine(i - 1)}`);
          if (sortedLines.getDistanceToNextLine(i - 1) <= joinLinesMaxTo) {
            container[index].addLine(line, sortedLines.getDistanceToNextLine(i - 1));
            console.log('adding');
          } else {
            console.log(`Total length of line ${container[index].getTotalLength()}`);
            console.log('new');
            container.push(new DistancePointContainer(line));
            index++;
          }
        }

        let result: DistancePointContainer = null;

        for (const o of container) {
          if (!result || result.getTotalLength() < o.getTotalLength()) {
            result = o;
          }
        }

        data.setData(targetName, result);

      }
      observer.next(data);
      observer.complete();
    }));
  }

// { eraseMap = [{x : 0, y : 0, width : 0, height : 0}]}
  public prepareGraft(joinLines = 100, sourceName = 'sortedLines', targetName = 'graftLines') {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      const sortedLines = data.getData(sourceName);

      if (sortedLines instanceof DistancePointContainer && sortedLines.hasLines()) {
        console.log('Preparing Graft');

        const container: DistancePointContainer[] = [];
        container.push(new DistancePointContainer(sortedLines.getLine(0)));
        let index = 0;

        for (let i = 1; i < sortedLines.getLines().length; i++) {
          const line = sortedLines.getLine(i);

          console.log(`Length of index ${i - 1} to next ${sortedLines.getDistanceToNextLine(i - 1)}`);
          if (sortedLines.getDistanceToNextLine(i - 1) <= joinLines) {
            container[index].addLine(line, sortedLines.getDistanceToNextLine(i - 1));
            console.log('adding');
          } else {
            console.log(`Total length of line ${container[index].getTotalLength()}`);
            console.log('new');
            sortedLines.setDistanceToNextLine(i - 1, -1);
            container.push(new DistancePointContainer(line));
            index++;
          }
        }


        data.setData(targetName, sortedLines);

      }
      observer.next(data);
      observer.complete();
    }));


    // this.prepareGraft({eraseMap: [{x: 1, y: 2, height: 100, width: 100}]})
  }

  public reducePoints({modulo = 10, sourceName = 'lines'}: { modulo?: number, sourceName?: string } = {}) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      const sortedLines = data.getData(sourceName);

      if (sortedLines instanceof ComplexLine) {
        console.log('Reduce Points');

        for (let i = 0; i < sortedLines.countLines(); i++) {
          const line = sortedLines.getLine(i);

          if (line instanceof SimpleLine) {
            const p = new SimpleLine();

            p.id = line.id;
            p.length = line.length;

            p.addPoint(line.getFirstPoint());

            for (let y = 1; y < line.points.length; y = y + modulo) {
              if (p.getLastPoint().x != line.points[y].x) {
                p.addPoint(line.points[y]);
              }
            }

            if (p.getLastPoint().x != line.getLastPoint().x) {
              p.points[p.points.length - 1] = line.getLastPoint();
              // p.addPoint(line.getLastPoint())
            }

            if (p.points.length < 2) {
              p.addPoint(line.getLastPoint());
            }

            sortedLines.setLine(i, p);
          }
        }
      }
      observer.next(data);
      observer.complete();
    }));
  }

  public reducePointsByDistance({distance = 10, sourceName = 'lines'}: { distance?: number, sourceName?: string } = {}) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      const sortedLines = data.getData(sourceName);

      if (sortedLines instanceof ComplexLine) {
        console.log('Reduce Points');
        VectorUtils.reduceLinePoints(sortedLines, distance);
      }
      observer.next(data);
      observer.complete();
    }));
  }

  public drawLines({color = '', size = 1, drawStartEndPoints = true, sourceName = 'sortedLines', drawPoints = false, drawSingleLines = false}: { color?: string, size?: number, drawStartEndPoints?: boolean, sourceName?: string, drawPoints?: boolean, drawSingleLines?: boolean } = {}) {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {

      const sortedLines = data.getData(sourceName);

      if (sortedLines instanceof ComplexLine) {
        console.log('Draw Lines');

        if (drawSingleLines) {
          DrawUtil.drawPointLinesOnCanvas(canvas, sortedLines.getPoints(), color == '' ? CImageUtil.colors[1] : color, size, drawPoints);
        } else {

          for (let i = 0; i < sortedLines.getLines().length; i++) {
            const line = sortedLines.getLine(i);

            DrawUtil.drawPointLinesOnCanvas(canvas, line.getPoints(), color == '' ? CImageUtil.colors[i + 1] : color, size, drawPoints);

            if (drawStartEndPoints) {
              DrawUtil.text(canvas, 'Start Line' + i, line.getPoints()[0], '12px Arial', 'red');
              DrawUtil.drawPoint(canvas, line.getPoints()[0], 'red');
              DrawUtil.text(canvas, 'End Line' + i, line.getPoints()[line.getPoints().length - 1], '12px Arial', 'blue');
              DrawUtil.drawPoint(canvas, line.getPoints()[line.getPoints().length - 1], 'blue');
            }
          }
          }
        data.img.data = DrawUtil.canvasAsBase64(canvas);
        }
      return data;
      }))
    );
  }

  public hostParabola(options?: { drawParabola?: true }) {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {

        const hostEpithelialValues = HostEpithelial.scanHost(data, canvas);
        const meanHostEpithelialValues = HostEpithelial.reduceMeanValues(hostEpithelialValues);
        const epithelialTopPoint = HostEpithelial.findTopPoint(meanHostEpithelialValues, canvas);
        const parabola = new HostParabola(epithelialTopPoint);
        parabola.optimize(meanHostEpithelialValues);
        parabola.drawParabola(canvas);
        data.setData('hostParabola', parabola);
        data.img.data = DrawUtil.canvasAsBase64(canvas);
        return data;
      }))
    );
  }

  public findGraftGap({color = 'red', sourceIndex = 1, sourceHostColor = 'red', sourceGraftColor = 'green'}: { color?: string, sourceIndex?: number, sourceHostColor?: string, sourceGraftColor?: string } = {}) {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {

      if (sourceIndex > 0 && sourceIndex < data.imgStack.length) {

        const img = data.imgStack[sourceIndex];
        const buff = new Buffer(img.data, 'base64');
        const png = PNG.sync.read(buff);

        for (let x = 0; x < png.width; x++) {
          let foundHost = -1;
          let foundGraft = -1;

          for (let y = 0; y < png.height; y++) {
            const idx = (png.width * y + x) << 2;

            if (png.data[idx] > 100) {
              foundHost = y;
            }

            if (png.data[idx + 1] > 100) {
              foundGraft = y;
            }
          }

          if (foundHost != -1 && foundGraft != -1 && foundHost < foundGraft) {
              for (let y = foundHost; y < foundGraft; y++) {
                DrawUtil.drawPoint(canvas, new Vector(x, y), 'blue', 1);
              }
            }
          }
        }

      data.img.data = DrawUtil.canvasAsBase64(canvas);
      return data;
      }))
    );
  }

  public host({color = 'red', size = 1, drawStartEndPoints = true, drawDistance = true, lineSourceName = 'lines', hostParabola = 'hostParabola'}: { color?: string, size?: number, drawStartEndPoints?: boolean, drawDistance?: boolean, lineSourceName?: string, hostParabola?: string } = {}) {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {

      const complexLine = data.getData(lineSourceName);
      const parabola = data.getData(hostParabola);

      if (complexLine instanceof ComplexLine && complexLine.hasPoints() && parabola instanceof HostParabola) {
        console.log('---');
        console.log(complexLine);
        const hostline = LineJoiner.joinComplexLine(complexLine, parabola, canvas);
        HostParabola.paintLines(hostline, canvas);
        data.setData('hostLine', hostline);
        }

      data.img.data = DrawUtil.canvasAsBase64(canvas);
      return data;
      }))
    );
  }


  public graft({color = 'red', size = 1, drawStartEndPoints = true, drawDistance = true, lineSourceName = 'graftLines', hostParabola = 'hostParabola'}: { color?: string, size?: number, drawStartEndPoints?: boolean, drawDistance?: boolean, lineSourceName?: string, hostParabola?: string } = {}) {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {

      const complexLine = data.getData(lineSourceName);
      const parabola = data.getData(hostParabola);

      if (complexLine instanceof ComplexLine && complexLine.hasPoints() && parabola instanceof HostParabola) {
        console.log('Graft');
        const likelyLines = GraftFinder.removeUnlikelyLines(complexLine, parabola, canvas);
        const joinedLines = GraftFinder.joinLines(likelyLines, parabola, canvas);
        parabola.drawParabola(canvas);

        data.setData('graftLines', joinedLines);
        }

      data.img.data = DrawUtil.canvasAsBase64(canvas);
      return data;
      }))
    );
  }

  public drawGraft(sourceName: string = 'lines') {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {

      const lines = data.getData(sourceName);
      const hostData = data.getData('hostData');

      if (lines instanceof DistancePointContainer && lines.hasLines() && hostData instanceof HostData) {
        let i = 0;
        for (const line of lines.getLines()) {

          const result: number[] = [];
          const points: Point[][] = [];

          for (const p of line.points) {
            // const equation = `(-500/(x - ${topPoint.x}))*(${p.x}-x)+(0.001*(x-${topPoint.x})*(x-${topPoint.x})+${topPoint.y})`;
            const eq = hostData.formula.replace('%p.x%', String(p.x));
            // console.log("P1 " + p.x + " " + p.y)
            // console.log(equation)

            try {
              const n1 = parse(eq);
              const quad = new Equation(n1, p.y);

              const answers = Math.round(quad.solveFor('x'));

              const y = Math.round(0.001 * Math.pow(answers - hostData.topPosition.x, 2) + hostData.topPosition.y);

              // console.log("x: " + answers + " y: " + y)

              DrawUtil.drawPointLineOnCanvas(canvas, p, new Point(answers, y), 'green');
              const linePoint = new Point(answers, y);
              const r = VectorUtils.distance(p, new Point(answers, y));

              points.push([p, linePoint]);

              result.push(r);
            } catch (e) {
              console.error('error');
            }
          }

          const mean = VectorUtils.mean(result);
          const dir = points.map(x => VectorUtils.directionVector(x[0], x[1]));
          const dirY = VectorUtils.mean(dir.map(x => x.y));

          console.log('Dir -----------------');
          console.log(`Dir ${dir[0].x}/${dir[0].y}`);
          console.log(`Dir ${dirY}`);

          DrawUtil.text(canvas, `Line ${i}`, new Point(points[0][0].x, points[0][0].y), '8px Arial', 'yellow');
          DrawUtil.text(canvas, `Dist ${mean}`, new Point(points[0][0].x, points[0][0].y + 10), '8px Arial', 'yellow');
          DrawUtil.text(canvas, `${Math.round(dir[0].x)} / ${Math.round(dir[0].y)}`, new Point(points[0][0].x, points[0][0].y + 20), '8px Arial', 'yellow');
          DrawUtil.text(canvas, `P ${points[0][0].x}/${points[0][0].y} - ${points[0][1].x}/${points[0][1].y}`, new Point(points[0][0].x, points[0][0].y + 30), '8px Arial', 'yellow');

          if (dirY < -10) {
            DrawUtil.drawPointLinesOnCanvas(canvas, line.points, 'red', 3);
            DrawUtil.text(canvas, `Out`, new Point(points[0][0].x, points[0][0].y + 40), '8px Arial', 'red');
          }


          if (mean < 50) {
            DrawUtil.drawPointLinesOnCanvas(canvas, line.points, CImageUtil.colors[i + 1], 2);
          } else {
            DrawUtil.drawPointLinesOnCanvas(canvas, line.points, 'red', 3);
          }


          i++;
        }
        }

      data.img.data = DrawUtil.canvasAsBase64(canvas);
      return data;
      }))
    );
  }

  /**
   * 0 = grey, 2 = color
   */
  public toColorType(colorType: ColorType) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
        const buff = new Buffer(data.img.data, 'base64');
        const png = PNG.sync.read(buff);
        const buffer = PNG.sync.write(png, {colorType});
        data.img.data = buffer.toString('base64');
        observer.next(data);
        observer.complete();
      }
    ));
  }


  public color(color: string, x = 0, y = 0, height: number = -1, width: number = -1) {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(
      map(canvas => {
        console.log(`Color img ${color}`);

        height = height < 0 ? canvas.height - y : height;
        width = width < 0 ? canvas.width - x : width;

        DrawUtil.drawRect(canvas, x, y, width, height, color);
        data.img.data = DrawUtil.canvasAsBase64(canvas);

        return data;
      })));
  }


  public prepareClasses(color: boolean = false) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {

      const buff = new Buffer(data.img.data, 'base64');
      const png = PNG.sync.read(buff);

      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          const idx = (png.width * y + x) << 2;

          if (!color) {
            if (png.data[idx] > 0) {
              png.data[idx] = 255;
              png.data[idx + 1] = 255;
              png.data[idx + 2] = 255;
            }
          } else {
            if (png.data[idx] > 200) {
              png.data[idx] = 255;
              png.data[idx + 1] = 0;
              png.data[idx + 2] = 0;
            } else if (png.data[idx + 1] > 200) {
              png.data[idx] = 0;
              png.data[idx + 1] = 255;
              png.data[idx + 2] = 0;
            } else if (png.data[idx + 2] > 200) {
              png.data[idx] = 0;
              png.data[idx + 1] = 0;
              png.data[idx + 2] = 255;
            } else {
              png.data[idx] = 255;
              png.data[idx + 1] = 255;
              png.data[idx + 2] = 255;
            }
          }
        }
        }

      const buffer = PNG.sync.write(png, {colorType: 0});
      data.img.data = buffer.toString('base64');
      observer.next(data);
      observer.complete();
      }
    ));
  }

  // public checkXProgression(color: string) {
  //   return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.getImg().data).pipe(map(canvas => {
  //     if (data.additionalData != null) {
  //       console.log("X Progression");
  //
  //       let lastX = 0;
  //       for (let i = 0; i < data.additionalData.length; i++) {
  //         for (let y = 0; y < data.additionalData[i].points; y++) {
  //
  //           if (lastX < data.additionalData[i].points[y].x) {
  //             console.error("Double Point");
  //           }
  //
  //           DrawUtil.drawPoint(canvas, data.additionalData[i].points[y], color, 2);
  //         }
  //       }
  //       return data;
  //     }
  //   })));
  // }

  public layer(layerID: string, color: string, size: number, drawPoints: boolean) {
    return flatMap((data: FilterData) => new Observable<Layer>((observer) => {
        let layer = null;
        for (const tmp of data.img.layers) {
        if (tmp.id == layerID) {
          layer = tmp;
          break;
        }
      }
        observer.next(layer);
        observer.complete();
      }).pipe(flatMap(layer => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {
        if (layer != null) {
          DrawUtil.drawManyPointLinesOnCanvas(canvas, layer.lines, color, size, drawPoints);
          data.img.data = DrawUtil.canvasAsBase64(canvas);
          console.log('layer img' + data.origName + ' ' + layer.id + ' ' + color);
        }
        return data;
      }))))
    );
  }

  public magic(command: string) {
    return flatMap((data: FilterData) =>
      this.imageMagicService.performMagic(data.img, command).pipe(
        map(cimg => {
            data.img = cimg;
            return data;
          }
        )
      )
    );
  }

  public cubicSpline(sourceName: string = 'sortedLines') {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {

      const sortedLines = data.getData(sourceName);

      if (sortedLines instanceof DistancePointContainer) {
        console.log('Cubic spline ');

        const Spline = require('cubic-spline');
        const lines = sortedLines.getLines();

        const xs: number[][] = [];
        const ys: number[][] = [];
        xs.push([]);
        ys.push([]);
        let index = 0;

        lines.forEach(line => {
          line.points.forEach(point => {
            if (xs[index].length == 0 || xs[index][xs[index].length - 1] != point.x) {
              xs[index].push(point.x);
              ys[index].push(point.y);
            } else {
              console.log('Skipping double points');
            }
          });

          if (sortedLines.getDistanceToNextLine(sortedLines.getIndexOfLine(line)) == -1) {
            // reversing
            if (xs[index][0] > xs[index][xs[index].length - 1]) {
              console.log('reverse line!');
              xs[index].reverse();
              xs[index].reverse();
            }

            xs.push([]);
            ys.push([]);
            index++;
          }
        });

        const cx = canvas.getContext('2d');
        cx.strokeStyle = 'green';
        cx.fillStyle = 'green';
        cx.lineWidth = 1;

        for (let i = 0; i < xs.length; i++) {
          // new a Spline object
          const spline = new Spline(xs[i], ys[i]);

          const start = xs[i][0];

          for (let i = start; i < 1300; i++) {
            const c = spline.at(i);
            if (!isNaN(c)) {
              cx.fillRect(i, c, 2, 2);
              console.log('draw Point at ' + i);
            }
          }
        }

        data.img.data = DrawUtil.canvasAsBase64(canvas);
        }
      return data;
      }))
    );
  }

  public spline({tension = 0.5, lineColor = '#00FF00', size = 1, drawPoints = false, sourceName = 'sortedLines'}) {
    return flatMap((data: FilterData) => DrawUtil.loadBase64AsCanvas(data.img.data).pipe(map(canvas => {
      const sortedLines = data.getData(sourceName);
      console.log(sortedLines + ' ' + sourceName);

      if (sortedLines instanceof DistancePointContainer) {
        console.log('spline ');

        const lines = sortedLines.getLines();

        const polys: CPolygon[] = [];
        polys.push(new CPolygon());
        let index = 0;

        lines.forEach(line => {
          line.points.forEach(point => {
            if (polys[index].x.length == 0 || polys[index].x[polys[index].x.length - 1] != point.x) {
              polys[index].addPoint(point.x, point.y);
            } else {
              console.log('Skipping double points');
            }
          });

          if (sortedLines.getDistanceToNextLine(sortedLines.getIndexOfLine(line)) == -1) {
            polys.push(new CPolygon());
            index++;
          }
        });

        for (let i = 0; i < polys.length; i++) {
          const bezierPoly = SplineUtil.computeSplineCurve(polys[i], tension, false);
          // draw each bezier segment
          const last = bezierPoly.size - 1;
          for (let i = 0; i < last; i += 3) {
            DrawUtil.drawSpline(canvas, bezierPoly.x[i], bezierPoly.y[i], bezierPoly.x[i + 1], bezierPoly.y[i + 1], bezierPoly.x[i + 2], bezierPoly.y[i + 2], bezierPoly.x[i + 3], bezierPoly.y[i + 3], lineColor, size, drawPoints);
          }
        }

        data.img.data = DrawUtil.canvasAsBase64(canvas);
      }
      console.log('Draw data');
      return data;
      }))
    );
  }

  public save(targetProject: string, datasetMapping: [{ dataset: string, mapping: string }], addDatasetAsPrefix: boolean = false, copyLayer: boolean = false, imageSuffix?: string) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {

      const oldID = data.origName.split('/');

      let newName = targetProject.replace('/', '') + '/';

      // searching for dataset mapping
      let oldDataset = '';
      let newDataset;

      for (let i = 1; i < oldID.length - 1; i++) {
        oldDataset += oldID[i] + '/';
      }

      oldDataset = oldDataset.slice(0, -1);

      if (datasetMapping.length == 1) {
        newDataset = datasetMapping[0].mapping;
      } else {
        for (let i = 0; i < datasetMapping.length; i++) {
          if (oldDataset === datasetMapping[i].dataset) {
            newDataset = datasetMapping[i].mapping;
            break;
          }
        }
      }

      newName += newDataset + '/';

      if (addDatasetAsPrefix) {
        newName += oldDataset.replace('/', '-') + '-';
      }

      newName += oldID[oldID.length - 1];


      if (imageSuffix) {
        newName += imageSuffix;
      }

      const newImg = Object.assign(new CImage(), data.img);
      newImg.id = btoa(newName);

      data.pushIMG(newImg);

      if (!copyLayer) {
        newImg.layers = data.img.layers;
      }

      observer.next(data);
      observer.complete();
    }).pipe(flatMap(data => this.imageService.createImage(data.img, 'png').pipe(
      map(newImg => {
        return data;
      }))
    )));
  }

  public display(displayCallback: DisplayCallback, img: number = -1) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      console.log(`Display img ${img} of ${data.imgStack.length}`);
      if (displayCallback != null) {
        if (img != -1) {
          displayCallback.displayCallBack(data.imgStack[img]);
        } else {
          displayCallback.displayCallBack(data.img);
        }
      }
      observer.next(data);
      observer.complete();
    }));
  }

  public overlay(imgs: number[], imageType: ColorType = 0) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {

        if (imgs.length >= 2 && data.imgStack.length >= 2) {

          console.log('Overlay');

          if (!isNumber(imgs[0]) && imgs[0] > 0 && imgs[0] < data.imgStack.length) {
            observer.error();
          }

          const buff = new Buffer(data.imgStack[imgs[0]].data, 'base64');
          const png = PNG.sync.read(buff);

          for (let i = 1; i < imgs.length; i++) {

            if (!isNumber(imgs[i]) && imgs[i] > 0 && imgs[i] < data.imgStack.length) {
              observer.error(`Wrong argument ${imgs[i]}`);
            }

            const buff2 = new Buffer(data.imgStack[imgs[i]].data, 'base64');
            const png2 = PNG.sync.read(buff2);

            // if (png.width != png2.width || png.height != png2.height){
            //   observer.error(`Image does not match ${png.width} - ${png2.width} / ${png.height} - ${png2.height}`);
            // }

            for (let y = 0; y < png.height; y++) {
              for (let x = 0; x < png.width; x++) {
                const idx = (png.width * y + x) << 2;

                // console.log(`${png2.data[idx]} - ${png2.data[idx+1]} - ${png2.data[idx+2]}`)
                if (png2.data[idx] > 0 || png2.data[idx + 1] > 0 || png2.data[idx + 2] > 0) {
                  png.data[idx] = png2.data[idx];
                  png.data[idx + 1] = png2.data[idx + 1];
                  png.data[idx + 2] = png2.data[idx + 2];
                }
              }
            }
          }

          //
          const buffer = PNG.sync.write(png, {colorType: imageType});
          this.pushImg();
          data.img.data = buffer.toString('base64');

          observer.next(data);
          observer.complete();
          console.log('overlay end');
        } else {
          observer.error();
        }
        observer.next(data);
        observer.complete();
      }
    ));
  }

  public showProgress(progressCallback) {

  }

  public pushImg(index ?: number) {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      console.log(`Pushing IMG Index ${index} to ${data.imgStack.length}`);

      const imToCopy = index != undefined ? data.imgStack[index] : data.img;
      const copy = Object.assign(new CImage(), imToCopy);
      copy.layers = imToCopy.layers;

      data.pushIMG(copy);

      console.log(data.imgStack.length);

      observer.next(data);
      observer.complete();
    }));
  }

  public popImg() {
    return flatMap((data: FilterData) => new Observable<FilterData>((observer) => {
      console.log(`Poping IMG ${data.imgStack.length - 1}`);
      data.popIMG();
      observer.next(data);
      observer.complete();
    }));
  }
}


class HostData {
  formula: string;
  topPosition: Point;

  constructor(formula: string, topPosition: Point) {
    this.formula = formula;
    this.topPosition = topPosition;
  }
}
