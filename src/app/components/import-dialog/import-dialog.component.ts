import {Component, OnInit} from '@angular/core';
import {MatDialogRef, MatSnackBar} from "@angular/material";
import {ScImportService} from "../../service/sc-import.service";

@Component({
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.component.html',
  styleUrls: ['./import-dialog.component.scss']
})
export class ImportDialogComponent implements OnInit {

  mapping = '{"maxX" : 1300, "maxY" :650, "checkImage" : true, "maps" : [{"name" : ".*", "path" : "image/michi2/", "prefix": "128-", "suffix": ".png"}]}';

  data: string;

  importIsRunning: boolean;

  constructor(public dialogRef: MatDialogRef<ImportDialogComponent>,
              public scImportService: ScImportService,
              private snackBar: MatSnackBar) {
  }

  ngOnInit() {
    this.importIsRunning = false;
  }

  import() {
    this.importIsRunning = true;


    if (this.mapping == undefined || this.data == undefined) {
      this.snackBar.open("Alle Daten angeben!");
      this.importIsRunning = false;
      return;
    }
    let mapping, data;

    try {
      mapping = JSON.parse(this.mapping);
      data = JSON.parse(this.data);
    } catch (e) {
      this.snackBar.open("Input nicht richtig formatiert");
      this.importIsRunning = false;
      return;
    }

    this.scImportService.processData(mapping, data).subscribe(results => {
      this.snackBar.open("Import beendet");
      this.importIsRunning = false;
    });

  }

  public close(): void {
    this.dialogRef.close();
  }
}
